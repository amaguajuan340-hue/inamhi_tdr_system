from pydantic import BaseModel, ConfigDict

# Campos compartidos para leer y crear
class UserBase(BaseModel):
    username: str
    role: str  # "Administrador" o "Técnico"

# Campos necesarios para la creación (cuando se registra un usuario)
class UserCreate(UserBase):
    password: str

# Estructura de datos que devolverá la API (oculta la contraseña por seguridad)
class UserResponse(UserBase):
    id: int

    # Mapeo automático para SQLAlchemy
    model_config = ConfigDict(from_attributes=True)