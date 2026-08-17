from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import obtener_usuario_actual
from app.models.tdr import TDR
from app.services import alertas as alertas_service
from app.services import auditoria as auditoria_service

router = APIRouter()


@router.get("/tdrs")
def listar_alertas_tdr(
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    """Devuelve todos los TDR con sus días restantes, nivel de alerta alcanzado
    y si están bloqueados (<=7 días), separando activos de vencidos/anulados."""
    tdrs = db.query(TDR).all()
    activos, vencidos = [], []

    for tdr in tdrs:
        dias = alertas_service.dias_restantes(tdr)
        item = {
            "id": tdr.id,
            "numero_tdr": tdr.numero_tdr,
            "nombre_tarea": tdr.nombre_tarea,
            "estado": tdr.estado,
            "fecha_finalizacion": tdr.fecha_finalizacion,
            "dias_restantes": dias,
            "nivel_alerta": alertas_service.nivel_alerta(dias),
            "bloqueado": alertas_service.esta_bloqueado(tdr),
        }
        if (tdr.estado or "").lower() in ("anulado", "vencido") or dias < 0:
            vencidos.append(item)
        else:
            activos.append(item)

    return {"activos": activos, "vencidos": vencidos}


@router.post("/verificar-admin")
def verificar_admin(
    password: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    """Valida la contraseña de un Administrador/Director para desbloquear la
    ventana de aviso de vencimiento crítico (<=7 días)."""
    valido = alertas_service.verificar_password_admin(db, password)

    auditoria_service.registrar(
        db, accion="DESBLOQUEO_ALERTA", usuario_id=usuario["id"], usuario_username=usuario["username"],
        entidad="Alerta", detalle="Intento de desbloqueo de alerta crítica" + (" exitoso" if valido else " fallido"),
    )

    return {"valido": valido}


@router.post("/ejecutar-verificacion")
def ejecutar_verificacion_manual(
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    """Dispara manualmente el barrido de alertas (útil para pruebas; también corre solo, una vez al día)."""
    alertas_service.ejecutar_verificacion_diaria(db)
    return {"message": "Verificación de alertas ejecutada"}
