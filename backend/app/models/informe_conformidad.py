from sqlalchemy import Column, Integer, Date, Boolean, ForeignKey
from app.core.database import Base


class InformeConformidad(Base):
    """Informe de conformidad (parcial o final) de un TDR."""
    __tablename__ = "informes_conformidad"

    id = Column(Integer, primary_key=True, index=True)
    tdr_id = Column(Integer, ForeignKey("tdrs.id"), nullable=False)
    fecha_emision = Column(Date, nullable=False)
    es_final = Column(Boolean, default=False)
    documento_id = Column(Integer, ForeignKey("documentos.id"), nullable=True)
