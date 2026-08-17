from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime, timezone
from app.core.database import Base


class Auditoria(Base):
    __tablename__ = "auditoria"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    usuario_username = Column(String, nullable=True)
    accion = Column(String, nullable=False)          # LOGIN, CREAR_TDR, EDITAR_TDR, APROBAR_TDR, ELIMINAR_TDR, RESET_PASSWORD, etc.
    entidad = Column(String, nullable=True)           # TDR, Usuario, etc.
    entidad_id = Column(Integer, nullable=True)
    detalle = Column(String, nullable=True)
    fecha = Column(DateTime, default=lambda: datetime.now(timezone.utc))
