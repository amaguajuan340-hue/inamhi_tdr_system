from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import requerir_rol
from app.core.catalogos import TIPOS_PROCESO, DIRECCIONES_SOLICITANTES, INDICADORES_CUMPLIMIENTO, TIPOS_DOCUMENTO
from app.models.tipo_documento_extra import TipoDocumentoExtra

router = APIRouter()


@router.get("/")
def obtener_catalogos(db: Session = Depends(get_db)):
    extras = [t.nombre for t in db.query(TipoDocumentoExtra).order_by(TipoDocumentoExtra.nombre).all()]
    return {
        "tipos_proceso": TIPOS_PROCESO,
        "direcciones_solicitantes": DIRECCIONES_SOLICITANTES,
        "indicadores_cumplimiento": INDICADORES_CUMPLIMIENTO,
        "tipos_documento": TIPOS_DOCUMENTO + extras,
    }


@router.post("/tipos-documento")
def agregar_tipo_documento(
    nombre: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    usuario: dict = Depends(requerir_rol("director")),
):
    nombre_limpio = nombre.strip()
    if not nombre_limpio:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    if nombre_limpio in TIPOS_DOCUMENTO:
        raise HTTPException(status_code=400, detail="Ese tipo de documento ya existe en el catálogo")

    existente = db.query(TipoDocumentoExtra).filter(TipoDocumentoExtra.nombre == nombre_limpio).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ese tipo de documento ya fue agregado")

    nuevo = TipoDocumentoExtra(nombre=nombre_limpio)
    db.add(nuevo)
    db.commit()
    return {"message": "Tipo de documento agregado", "nombre": nombre_limpio}
