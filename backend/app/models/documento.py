from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime, timezone
from app.core.database import Base


class Documento(Base):
    """Archivo PDF asociado a un TDR: informe de necesidad, TDR, o cualquiera
    de los documentos obligatorios del catálogo institucional."""
    __tablename__ = "documentos"

    id = Column(Integer, primary_key=True, index=True)
    tdr_id = Column(Integer, ForeignKey("tdrs.id"), nullable=False)
    tipo_documento = Column(String, nullable=False)   # valor tomado de app.core.catalogos.TIPOS_DOCUMENTO
    nombre_archivo = Column(String, nullable=False)
    ruta_archivo = Column(String, nullable=False)
    subido_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    fecha_subida = Column(DateTime, default=lambda: datetime.now(timezone.utc))
