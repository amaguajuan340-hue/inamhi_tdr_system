from sqlalchemy import Column, Integer, String, Boolean
# Corregido: Apunta a la carpeta 'core' donde está tu configuración real
from app.core.database import Base 

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False) # Ej. lcorrea
    nombre_completo = Column(String, nullable=False)                    # Ej. Luis Correa
    password_hash = Column(String, nullable=False)                      # Contraseña encriptada
    role = Column(String, nullable=False)                                # "tecnico" o "director"
    activo = Column(Boolean, default=True)