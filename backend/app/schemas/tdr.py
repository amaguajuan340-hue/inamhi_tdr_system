from pydantic import BaseModel, ConfigDict, field_validator
from datetime import date, datetime
from app.core.catalogos import TIPOS_PROCESO, DIRECCIONES_SOLICITANTES

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

# Esquema para cuando un Técnico o Administrador cree un nuevo registro.
# Los catálogos solo se validan al crear: los TDR antiguos pueden tener
# valores de texto libre y no deben romper la lectura/listado.
class TDRCreate(TDRBase):
    @field_validator("tipo_proceso")
    @classmethod
    def validar_tipo_proceso(cls, v):
        if v not in TIPOS_PROCESO:
            raise ValueError(f"tipo_proceso debe ser uno de: {', '.join(TIPOS_PROCESO)}")
        return v

    @field_validator("direccion_solicitante")
    @classmethod
    def validar_direccion_solicitante(cls, v):
        if v not in DIRECCIONES_SOLICITANTES:
            raise ValueError(f"direccion_solicitante debe ser uno de: {', '.join(DIRECCIONES_SOLICITANTES)}")
        return v

# Estructura de datos que devolverá la API al consultar un TDR
class TDRResponse(TDRBase):
    id: int
    estado: str
    creado_por_id: int | None = None
    fecha_creacion: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
