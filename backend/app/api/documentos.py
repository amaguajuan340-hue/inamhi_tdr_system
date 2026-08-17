import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import obtener_usuario_actual, requerir_rol
from app.core.catalogos import TIPOS_DOCUMENTO
from app.models.documento import Documento
from app.models.tdr import TDR
from app.services import archivos as archivos_service
from app.services import auditoria as auditoria_service

router = APIRouter()


@router.get("/catalogo")
def obtener_catalogo_documentos():
    return TIPOS_DOCUMENTO


@router.post("/tdrs/{tdr_id}")
async def subir_documento(
    tdr_id: int,
    tipo_documento: str = Form(...),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    if tipo_documento not in TIPOS_DOCUMENTO:
        raise HTTPException(status_code=400, detail="Tipo de documento no reconocido")

    tdr = db.query(TDR).filter(TDR.id == tdr_id).first()
    if not tdr:
        raise HTTPException(status_code=404, detail="TDR no encontrado")

    nombre_original, ruta_relativa = archivos_service.guardar_pdf(archivo, tdr_id)

    doc = Documento(
        tdr_id=tdr_id,
        tipo_documento=tipo_documento,
        nombre_archivo=nombre_original,
        ruta_archivo=ruta_relativa,
        subido_por_id=usuario["id"],
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    auditoria_service.registrar(
        db, accion="CARGAR_DOCUMENTO", usuario_id=usuario["id"], usuario_username=usuario["username"],
        entidad="Documento", entidad_id=doc.id,
        detalle=f"Subió '{nombre_original}' ({tipo_documento}) al TDR {tdr.numero_tdr}",
    )

    return {
        "id": doc.id,
        "tdr_id": doc.tdr_id,
        "tipo_documento": doc.tipo_documento,
        "nombre_archivo": doc.nombre_archivo,
        "fecha_subida": doc.fecha_subida,
    }


@router.get("/tdrs/{tdr_id}")
def listar_documentos(
    tdr_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    docs = db.query(Documento).filter(Documento.tdr_id == tdr_id).all()
    return [
        {
            "id": d.id,
            "tipo_documento": d.tipo_documento,
            "nombre_archivo": d.nombre_archivo,
            "fecha_subida": d.fecha_subida,
        }
        for d in docs
    ]


@router.get("/{documento_id}/descargar")
def descargar_documento(
    documento_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    doc = db.query(Documento).filter(Documento.id == documento_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    ruta = archivos_service.ruta_completa(doc.ruta_archivo)
    if not os.path.exists(ruta):
        raise HTTPException(status_code=404, detail="El archivo ya no existe en el servidor")

    return FileResponse(ruta, media_type="application/pdf", filename=doc.nombre_archivo)


@router.delete("/{documento_id}")
def eliminar_documento(
    documento_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requerir_rol("director")),
):
    doc = db.query(Documento).filter(Documento.id == documento_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    ruta = archivos_service.ruta_completa(doc.ruta_archivo)
    if os.path.exists(ruta):
        os.remove(ruta)

    nombre = doc.nombre_archivo
    db.delete(doc)
    db.commit()

    auditoria_service.registrar(
        db, accion="ELIMINAR_DOCUMENTO", usuario_id=usuario["id"], usuario_username=usuario["username"],
        entidad="Documento", entidad_id=documento_id, detalle=f"Eliminó el archivo '{nombre}'",
    )

    return {"message": "Documento eliminado exitosamente"}
