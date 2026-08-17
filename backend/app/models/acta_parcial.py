from sqlalchemy import Column, Integer, Date, ForeignKey
from app.core.database import Base


class ActaParcial(Base):
    """Acta parcial, mensual o anual de pago asociada a un TDR."""
    __tablename__ = "actas_parciales"

    id = Column(Integer, primary_key=True, index=True)
    tdr_id = Column(Integer, ForeignKey("tdrs.id"), nullable=False)
    fecha_acta = Column(Date, nullable=False)
    documento_id = Column(Integer, ForeignKey("documentos.id"), nullable=True)
