from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List
from app.core.database import SessionLocal
from app.schemas.tdr import TDRCreate, TDRResponse
from app.services import tdr as tdr_service

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Ruta para crear un nuevo TDR
@router.post("/", response_model=TDRResponse)
def create_tdr(tdr: TDRCreate, db: Session = Depends(get_db)):
    return tdr_service.create_tdr(db=db, tdr=tdr)

# Ruta para consultar la lista de todos los TDRs
@router.get("/", response_model=List[TDRResponse])
def read_tdrs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return tdr_service.get_tdrs(db, skip=skip, limit=limit)
@router.put("/{tdr_id}/aprobar")
def aprobar_tdr(tdr_id: int, db: Session = Depends(get_db)):
    # 1. Buscamos el TDR por su ID en la base de datos
    # (Nota: Si tu modelo importado se llama de otra forma como 'Tdr', ajusta la mayúscula)
    from app.models.tdr import TDR 
    
    db_tdr = db.query(TDR).filter(TDR.id == tdr_id).first()
    
    # 2. Si no existe, enviamos un error
    if not db_tdr:
        raise HTTPException(status_code=404, detail="TDR no encontrado")
    
    # 3. Cambiamos el estado y guardamos
    db_tdr.estado = "Aprobado"
    db.commit()
    db.refresh(db_tdr)
    
    return {"message": "TDR aprobado exitosamente", "tdr": db_tdr}
@router.delete("/{tdr_id}")
def eliminar_tdr(tdr_id: int, db: Session = Depends(get_db)):
    from app.models.tdr import TDR # Ajusta a 'Tdr' si tu modelo usa minúsculas
    
    # 1. Buscar el TDR en la base de datos
    db_tdr = db.query(TDR).filter(TDR.id == tdr_id).first()
    
    # 2. Si no existe, lanzar error
    if not db_tdr:
        raise HTTPException(status_code=404, detail="TDR no encontrado")
    
    # 3. Eliminar de la base de datos y confirmar
    db.delete(db_tdr)
    db.commit()
    
    return {"message": "TDR eliminado exitosamente"}
@router.put("/{tdr_id}")
def actualizar_tdr(tdr_id: int, tdr_actualizado: dict = Body(...), db: Session = Depends(get_db)):
    from app.models.tdr import TDR # Ajusta a 'Tdr' si tu modelo usa minúsculas
    from datetime import date
    
    # 1. Buscar el TDR existente
    db_tdr = db.query(TDR).filter(TDR.id == tdr_id).first()
    if not db_tdr:
        raise HTTPException(status_code=404, detail="TDR no encontrado")
        
    # 2. Bloquear edición si ya está aprobado
    if db_tdr.estado.lower() == "aprobado":
        raise HTTPException(status_code=400, detail="No se puede modificar un TDR ya aprobado")
    
    # 3. Actualizar los campos dinámicamente convirtiendo las fechas de string a objeto date
    for llave, valor in tdr_actualizado.items():
        if hasattr(db_tdr, llave):
            # Si el campo es una fecha y viene como texto, lo convertimos a objeto date de Python
            if llave in ["fecha_inicio", "fecha_finalizacion"] and isinstance(valor, str) and valor:
                try:
                    valor = date.fromisoformat(valor)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Formato de fecha inválido para {llave}")
            
            setattr(db_tdr, llave, valor)
            
    db.commit()
    db.refresh(db_tdr)
    return {"message": "TDR actualizado con éxito", "tdr": db_tdr}