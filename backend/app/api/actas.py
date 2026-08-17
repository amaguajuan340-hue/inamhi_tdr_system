from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import obtener_usuario_actual, requerir_rol
from app.models.acta_parcial import ActaParcial
from app.models.tdr import TDR
from app.models.documento import Documento
from app.services import archivos as archivos_service
from app.services import auditoria as auditoria_service

router = APIRouter()


@router.post("/tdrs/{tdr_id}")
async def crear_acta(
    tdr_id: int,
    fecha_acta: str = Form(...),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    tdr = db.query(TDR).filter(TDR.id == tdr_id).first()
    if not tdr:
        raise HTTPException(status_code=404, detail="TDR no encontrado")

    nombre_original, ruta_relativa = archivos_service.guardar_pdf(archivo, tdr_id)
    doc = Documento(
        tdr_id=tdr_id, tipo_documento="Acta parcial de pago",
        nombre_archivo=nombre_original, ruta_archivo=ruta_relativa, subido_por_id=usuario["id"],
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    acta = ActaParcial(tdr_id=tdr_id, fecha_acta=date.fromisoformat(fecha_acta), documento_id=doc.id)
    db.add(acta)
    db.commit()
    db.refresh(acta)

    auditoria_service.registrar(
        db, accion="CREAR_ACTA", usuario_id=usuario["id"], usuario_username=usuario["username"],
        entidad="ActaParcial", entidad_id=acta.id, detalle=f"Cargó acta parcial en TDR {tdr.numero_tdr}",
    )

    return {"id": acta.id, "fecha_acta": acta.fecha_acta, "documento_id": acta.documento_id}


@router.get("/tdrs/{tdr_id}")
def listar_actas(
    tdr_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    actas = db.query(ActaParcial).filter(ActaParcial.tdr_id == tdr_id).order_by(ActaParcial.fecha_acta).all()
    return [{"id": a.id, "fecha_acta": a.fecha_acta, "documento_id": a.documento_id} for a in actas]


@router.delete("/{acta_id}")
def eliminar_acta(
    acta_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requerir_rol("director")),
):
    acta = db.query(ActaParcial).filter(ActaParcial.id == acta_id).first()
    if not acta:
        raise HTTPException(status_code=404, detail="Acta no encontrada")
    db.delete(acta)
    db.commit()
    return {"message": "Acta eliminada exitosamente"}
