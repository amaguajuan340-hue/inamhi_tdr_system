from sqlalchemy.orm import Session
from app.models.tdr import TDR
from app.schemas.tdr import TDRCreate

def create_tdr(db: Session, tdr: TDRCreate, creado_por_id: int | None = None):
    # Transforma los datos validados del schema y los guarda en la tabla
    db_tdr = TDR(**tdr.model_dump(), creado_por_id=creado_por_id)
    db.add(db_tdr)
    db.commit()
    db.refresh(db_tdr)
    return db_tdr

def get_tdrs(db: Session, skip: int = 0, limit: int = 100):
    # Consulta todos los TDRs registrados (con un límite para no saturar el sistema)
    return db.query(TDR).offset(skip).limit(limit).all()