from sqlalchemy import Column, Integer, String, Date, ForeignKey
from app.core.database import Base


class Soporte(Base):
    """Mantenimiento o soporte de un TDR, con su informe de cumplimiento."""
    __tablename__ = "soportes"

    id = Column(Integer, primary_key=True, index=True)
    tdr_id = Column(Integer, ForeignKey("tdrs.id"), nullable=False)
    numero = Column(String, nullable=False)
    fecha_programada = Column(Date, nullable=False)
    indicador_cumplimiento = Column(String, default="No")  # Si, No, Parcial
    documento_id = Column(Integer, ForeignKey("documentos.id"), nullable=True)
