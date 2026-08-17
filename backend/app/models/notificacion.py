from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from datetime import datetime, timezone
from app.core.database import Base


class Notificacion(Base):
    """Historial de alertas de vencimiento ya emitidas por TDR, para no repetir
    el mismo aviso (90/60/30/20/7 días) más de una vez."""
    __tablename__ = "notificaciones"

    id = Column(Integer, primary_key=True, index=True)
    tdr_id = Column(Integer, ForeignKey("tdrs.id"), nullable=False)
    nivel_alerta = Column(Integer, nullable=False)   # 90, 60, 30, 20 o 7 (días restantes)
    fecha_envio = Column(DateTime, default=lambda: datetime.now(timezone.utc))
