from pydantic import BaseModel, ConfigDict
from datetime import date

# Campos base obligatorios según los requerimientos del INAMHI
class TDRBase(BaseModel):
    numero_tdr: str
    tipo_proceso: str
    direccion_solicitante: str
    nombre_tarea: str
    presupuesto_codificado: float
    responsable_designado: str
    periodo_contrato: str
    fecha_inicio: date
    fecha_finalizacion: date

# Esquema para cuando un Técnico o Administrador cree un nuevo registro
class TDRCreate(TDRBase):
    pass

# Estructura de datos que devolverá la API al consultar un TDR
class TDRResponse(TDRBase):
    id: int
    estado: str

    model_config = ConfigDict(from_attributes=True)