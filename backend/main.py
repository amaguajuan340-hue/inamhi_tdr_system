from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.models import user, tdr

# Importaciones explícitas para asegurar la creación de las tablas en SQLite
from app.models.user import Usuario
from app.models.tdr import TDR

from app.api import user as user_api
from app.api import tdr as tdr_api

# Inicialización de la base de datos (Aquí se creará la tabla 'usuarios')
Base.metadata.create_all(bind=engine)

# Inicializamos la aplicación
app = FastAPI(title="API Sistema TDR - INAMHI")

# CONFIGURACIÓN CORS: El "puente" de permisos para la futura interfaz web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite que cualquier frontend se conecte (ideal para desarrollo local)
    allow_credentials=True,
    allow_methods=["*"],  # Permite todos los métodos (GET, POST, PUT, DELETE)
    allow_headers=["*"],  # Permite todo tipo de encabezados
)

# Conectamos las rutas
app.include_router(user_api.router, prefix="/api/users", tags=["Usuarios"])
app.include_router(tdr_api.router, prefix="/api/tdrs", tags=["Términos de Referencia"])

@app.get("/")
def read_root():
    return {"mensaje": "Servidor del Sistema TDR del INAMHI funcionando. Rutas y CORS configurados exitosamente."}

# ==========================================================
# PUNTO DE ENTRADA Y CONFIGURACIÓN DEL PUERTO (PUERTO 8001)
# ==========================================================
import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)