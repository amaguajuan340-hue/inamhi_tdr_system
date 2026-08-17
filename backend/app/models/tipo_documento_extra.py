from sqlalchemy import Column, Integer, String
from app.core.database import Base


class TipoDocumentoExtra(Base):
    """Tipos de documento agregados manualmente por un Director, además del catálogo base."""
    __tablename__ = "tipos_documento_extra"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, nullable=False)
