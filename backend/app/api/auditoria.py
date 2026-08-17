from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import requerir_rol
from app.models.auditoria import Auditoria

router = APIRouter()


@router.get("/")
def listar_auditoria(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requerir_rol("director")),
):
    registros = (
        db.query(Auditoria)
        .order_by(Auditoria.fecha.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "usuario_username": r.usuario_username,
            "accion": r.accion,
            "entidad": r.entidad,
            "entidad_id": r.entidad_id,
            "detalle": r.detalle,
            "fecha": r.fecha,
        }
        for r in registros
    ]
