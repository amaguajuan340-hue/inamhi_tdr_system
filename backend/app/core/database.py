from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Ruta de tu base de datos SQLite institucional
DATABASE_URL = "sqlite:///./tdr_system.db"

# Crear el motor de la base de datos
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# Creador de sesiones locales
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Clase base para los modelos (User, TDR, etc.)
Base = declarative_base()

# ⬇️ ESTA ES LA FUNCIÓN QUE FALTABA ⬇️
def get_db():
    """Generador de conexiones a la base de datos para los endpoints"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()