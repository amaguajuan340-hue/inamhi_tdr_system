from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import obtener_usuario_actual, requerir_rol
from app.core.catalogos import INDICADORES_CUMPLIMIENTO
from app.models.soporte import Soporte
from app.models.tdr import TDR
from app.models.documento import Documento
from app.services import archivos as archivos_service
from app.services import auditoria as auditoria_service

router = APIRouter()


@router.post("/tdrs/{tdr_id}")
async def crear_soporte(
    tdr_id: int,
    fecha_programada: str = Form(...),
    indicador_cumplimiento: str = Form("No"),
    archivo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    tdr = db.query(TDR).filter(TDR.id == tdr_id).first()
    if not tdr:
        raise HTTPException(status_code=404, detail="TDR no encontrado")

    if indicador_cumplimiento not in INDICADORES_CUMPLIMIENTO:
        raise HTTPException(status_code=400, detail="Indicador de cumplimiento inválido")

    fecha = date.fromisoformat(fecha_programada)
    if (indicador_cumplimiento != "No" or archivo is not None) and fecha > date.today():
        raise HTTPException(
            status_code=400,
            detail="No se puede registrar cumplimiento ni informe antes de la fecha programada",
        )

    documento_id = None
    if archivo is not None:
        nombre_original, ruta_relativa = archivos_service.guardar_pdf(archivo, tdr_id)
        doc = Documento(
            tdr_id=tdr_id, tipo_documento="Informe de soporte/mantenimiento",
            nombre_archivo=nombre_original, ruta_archivo=ruta_relativa, subido_por_id=usuario["id"],
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        documento_id = doc.id

    total_previos = db.query(Soporte).filter(Soporte.tdr_id == tdr_id).count()
    numero = f"SOP-{total_previos + 1:03d}"

    soporte = Soporte(
        tdr_id=tdr_id,
        numero=numero,
        fecha_programada=fecha,
        indicador_cumplimiento=indicador_cumplimiento,
        documento_id=documento_id,
    )
    db.add(soporte)
    db.commit()
    db.refresh(soporte)

    auditoria_service.registrar(
        db, accion="CREAR_SOPORTE", usuario_id=usuario["id"], usuario_username=usuario["username"],
        entidad="Soporte", entidad_id=soporte.id, detalle=f"Registró soporte {numero} en TDR {tdr.numero_tdr}",
    )

    return {
        "id": soporte.id, "numero": soporte.numero, "fecha_programada": soporte.fecha_programada,
        "indicador_cumplimiento": soporte.indicador_cumplimiento, "documento_id": soporte.documento_id,
    }


@router.get("/tdrs/{tdr_id}")
def listar_soportes(
    tdr_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    soportes = db.query(Soporte).filter(Soporte.tdr_id == tdr_id).all()
    return [
        {
            "id": s.id, "numero": s.numero, "fecha_programada": s.fecha_programada,
            "indicador_cumplimiento": s.indicador_cumplimiento, "documento_id": s.documento_id,
        }
        for s in soportes
    ]


@router.put("/{soporte_id}")
def actualizar_soporte(
    soporte_id: int,
    indicador_cumplimiento: str = Form(...),
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    if indicador_cumplimiento not in INDICADORES_CUMPLIMIENTO:
        raise HTTPException(status_code=400, detail="Indicador de cumplimiento inválido")

    soporte = db.query(Soporte).filter(Soporte.id == soporte_id).first()
    if not soporte:
        raise HTTPException(status_code=404, detail="Soporte no encontrado")

    if indicador_cumplimiento != "No" and soporte.fecha_programada > date.today():
        raise HTTPException(
            status_code=400,
            detail="No se puede registrar cumplimiento antes de la fecha programada",
        )

    soporte.indicador_cumplimiento = indicador_cumplimiento
    db.commit()
    db.refresh(soporte)
    return {"message": "Soporte actualizado", "indicador_cumplimiento": soporte.indicador_cumplimiento}


@router.delete("/{soporte_id}")
def eliminar_soporte(
    soporte_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requerir_rol("director")),
):
    soporte = db.query(Soporte).filter(Soporte.id == soporte_id).first()
    if not soporte:
        raise HTTPException(status_code=404, detail="Soporte no encontrado")
    db.delete(soporte)
    db.commit()
    return {"message": "Soporte eliminado exitosamente"}
