from sqlalchemy.orm import Session
from app.models.auditoria import Auditoria


def registrar(
    db: Session,
    accion: str,
    usuario_id: int | None = None,
    usuario_username: str | None = None,
    entidad: str | None = None,
    entidad_id: int | None = None,
    detalle: str | None = None,
):
    log = Auditoria(
        usuario_id=usuario_id,
        usuario_username=usuario_username,
        accion=accion,
        entidad=entidad,
        entidad_id=entidad_id,
        detalle=detalle,
    )
    db.add(log)
    db.commit()
