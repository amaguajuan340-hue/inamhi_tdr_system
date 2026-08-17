from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List
from app.core.database import SessionLocal
from app.core.security import obtener_usuario_actual, requerir_rol
from app.schemas.tdr import TDRCreate, TDRResponse
from app.services import tdr as tdr_service
from app.services import auditoria as auditoria_service
from app.models.tdr import TDR

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Ruta para crear un nuevo TDR (técnico o director, ambos autenticados)
@router.post("/", response_model=TDRResponse)
def create_tdr(
    tdr: TDRCreate,
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    nuevo = tdr_service.create_tdr(db=db, tdr=tdr, creado_por_id=usuario["id"])
    auditoria_service.registrar(
        db, accion="CREAR_TDR", usuario_id=usuario["id"], usuario_username=usuario["username"],
        entidad="TDR", entidad_id=nuevo.id, detalle=f"Creó el TDR {nuevo.numero_tdr}",
    )
    return nuevo

# Ruta para consultar la lista de todos los TDRs (cualquier usuario autenticado)
@router.get("/", response_model=List[TDRResponse])
def read_tdrs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    return tdr_service.get_tdrs(db, skip=skip, limit=limit)

# Solo el director puede aprobar un TDR
@router.put("/{tdr_id}/aprobar")
def aprobar_tdr(
    tdr_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requerir_rol("director")),
):
    db_tdr = db.query(TDR).filter(TDR.id == tdr_id).first()
    if not db_tdr:
        raise HTTPException(status_code=404, detail="TDR no encontrado")

    db_tdr.estado = "Aprobado"
    db.commit()
    db.refresh(db_tdr)

    auditoria_service.registrar(
        db, accion="APROBAR_TDR", usuario_id=usuario["id"], usuario_username=usuario["username"],
        entidad="TDR", entidad_id=db_tdr.id, detalle=f"Aprobó el TDR {db_tdr.numero_tdr}",
    )

    return {"message": "TDR aprobado exitosamente", "tdr": db_tdr}

# Solo el director puede eliminar TDR
@router.delete("/{tdr_id}")
def eliminar_tdr(
    tdr_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requerir_rol("director")),
):
    db_tdr = db.query(TDR).filter(TDR.id == tdr_id).first()
    if not db_tdr:
        raise HTTPException(status_code=404, detail="TDR no encontrado")

    numero_tdr = db_tdr.numero_tdr
    db.delete(db_tdr)
    db.commit()

    auditoria_service.registrar(
        db, accion="ELIMINAR_TDR", usuario_id=usuario["id"], usuario_username=usuario["username"],
        entidad="TDR", entidad_id=tdr_id, detalle=f"Eliminó el TDR {numero_tdr}",
    )

    return {"message": "TDR eliminado exitosamente"}

# Actualizar TDR: el director puede editar cualquiera; el técnico solo los suyos en Borrador
@router.put("/{tdr_id}")
def actualizar_tdr(
    tdr_id: int,
    tdr_actualizado: dict = Body(...),
    db: Session = Depends(get_db),
    usuario: dict = Depends(obtener_usuario_actual),
):
    from datetime import date

    db_tdr = db.query(TDR).filter(TDR.id == tdr_id).first()
    if not db_tdr:
        raise HTTPException(status_code=404, detail="TDR no encontrado")

    if usuario["role"] != "director":
        if db_tdr.creado_por_id != usuario["id"]:
            raise HTTPException(status_code=403, detail="Solo puedes modificar TDR creados por ti")
        if (db_tdr.estado or "").lower() != "borrador":
            raise HTTPException(status_code=403, detail="Solo puedes modificar TDR en estado Borrador")

    if db_tdr.estado.lower() == "aprobado" and usuario["role"] != "director":
        raise HTTPException(status_code=400, detail="No se puede modificar un TDR ya aprobado")

    for llave, valor in tdr_actualizado.items():
        if hasattr(db_tdr, llave) and llave not in ("id", "creado_por_id"):
            if llave in ["fecha_inicio", "fecha_finalizacion"] and isinstance(valor, str) and valor:
                try:
                    valor = date.fromisoformat(valor)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Formato de fecha inválido para {llave}")

            setattr(db_tdr, llave, valor)

    db.commit()
    db.refresh(db_tdr)

    auditoria_service.registrar(
        db, accion="EDITAR_TDR", usuario_id=usuario["id"], usuario_username=usuario["username"],
        entidad="TDR", entidad_id=db_tdr.id, detalle=f"Editó el TDR {db_tdr.numero_tdr}",
    )

    return {"message": "TDR actualizado con éxito", "tdr": db_tdr}
