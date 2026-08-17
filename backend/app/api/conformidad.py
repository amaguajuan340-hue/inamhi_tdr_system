from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import obtener_usuario_actual, requerir_rol
from app.models.informe_conformidad import InformeConformidad
from app.models.tdr import TDR
from app.models.documento import Documento
from app.services import archivos as archivos_service
from app.services import auditoria as auditoria_service

router = APIRouter()


@router.post("/tdrs/{tdr_id}")
async def crear_informe_conformidad(
    tdr_id: int,
    fecha_emision: str = Form(...),
    es_final: bool = Form(False),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    tdr = db.query(TDR).filter(TDR.id == tdr_id).first()
    if not tdr:
        raise HTTPException(status_code=404, detail="TDR no encontrado")

    tipo = "Informe de conformidad final" if es_final else "Informe de conformidad parcial"
    nombre_original, ruta_relativa = archivos_service.guardar_pdf(archivo, tdr_id)
    doc = Documento(
        tdr_id=tdr_id, tipo_documento=tipo,
        nombre_archivo=nombre_original, ruta_archivo=ruta_relativa, subido_por_id=usuario["id"],
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    informe = InformeConformidad(
        tdr_id=tdr_id, fecha_emision=date.fromisoformat(fecha_emision), es_final=es_final, documento_id=doc.id,
    )
    db.add(informe)
    db.commit()
    db.refresh(informe)

    auditoria_service.registrar(
        db, accion="CREAR_INFORME_CONFORMIDAD", usuario_id=usuario["id"], usuario_username=usuario["username"],
        entidad="InformeConformidad", entidad_id=informe.id,
        detalle=f"Cargó {tipo} en TDR {tdr.numero_tdr}",
    )

    return {
        "id": informe.id, "fecha_emision": informe.fecha_emision,
        "es_final": informe.es_final, "documento_id": informe.documento_id,
    }


@router.get("/tdrs/{tdr_id}")
def listar_informes_conformidad(
    tdr_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    informes = (
        db.query(InformeConformidad)
        .filter(InformeConformidad.tdr_id == tdr_id)
        .order_by(InformeConformidad.fecha_emision)
        .all()
    )
    return [
        {"id": i.id, "fecha_emision": i.fecha_emision, "es_final": i.es_final, "documento_id": i.documento_id}
        for i in informes
    ]


@router.delete("/{informe_id}")
def eliminar_informe_conformidad(
    informe_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requerir_rol("director")),
):
    informe = db.query(InformeConformidad).filter(InformeConformidad.id == informe_id).first()
    if not informe:
        raise HTTPException(status_code=404, detail="Informe no encontrado")
    db.delete(informe)
    db.commit()
    return {"message": "Informe eliminado exitosamente"}
