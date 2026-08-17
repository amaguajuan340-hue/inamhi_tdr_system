from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from datetime import datetime, timezone
from app.core.database import Base

class TDR(Base):
    __tablename__ = "tdrs"

    id = Column(Integer, primary_key=True, index=True)
    
    # Datos Generales del TDR obligatorios según el requerimiento institucional
    numero_tdr = Column(String, unique=True, index=True, nullable=False)
    tipo_proceso = Column(String, nullable=False)          # Ínfima cuantía, Catálogo electrónico, Régimen especial, Subasta inversa
    direccion_solicitante = Column(String, nullable=False) # TICs, Dirección Administrativa Financiera, Dirección Ejecutiva, Otras
    nombre_tarea = Column(String, nullable=False)
    presupuesto_codificado = Column(Float, nullable=False)
    responsable_designado = Column(String, nullable=False)
    periodo_contrato = Column(String, nullable=False)       # 1 año, 3 años, etc.
    
    # Fechas críticas para el motor automatizado de alertas de vencimiento
    fecha_inicio = Column(Date, nullable=False)
    fecha_finalizacion = Column(Date, nullable=False)
    
    # Control de flujo de estados del ciclo de vida del TDR
    estado = Column(String, default="Borrador")            # Borrador, Aprobado, Activo, Vencido

    # Autor del registro, para restringir edición del Técnico a sus propios TDR en Borrador
    creado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    # Fecha de creación del registro, para búsqueda/filtrado y auditoría
    fecha_creacion = Column(DateTime, default=lambda: datetime.now(timezone.utc))