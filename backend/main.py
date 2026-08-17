from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.models import user, tdr, auditoria, documento, soporte, acta_parcial, informe_conformidad, notificacion, tipo_documento_extra

# Importaciones explícitas para asegurar la creación de las tablas en SQLite
from app.models.user import Usuario
from app.models.tdr import TDR
from app.models.auditoria import Auditoria
from app.models.documento import Documento
from app.models.soporte import Soporte
from app.models.acta_parcial import ActaParcial
from app.models.informe_conformidad import InformeConformidad
from app.models.tipo_documento_extra import TipoDocumentoExtra
from app.models.notificacion import Notificacion

from app.api import user as user_api
from app.api import tdr as tdr_api
from app.api import auditoria as auditoria_api
from app.api import documentos as documentos_api
from app.api import soportes as soportes_api
from app.api import actas as actas_api
from app.api import conformidad as conformidad_api
from app.api import catalogos as catalogos_api
from app.api import alertas as alertas_api

from apscheduler.schedulers.background import BackgroundScheduler
from app.core.database import SessionLocal
from app.services import alertas as alertas_service

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
app.include_router(auditoria_api.router, prefix="/api/auditoria", tags=["Auditoría"])
app.include_router(documentos_api.router, prefix="/api/documentos", tags=["Documentos"])
app.include_router(soportes_api.router, prefix="/api/soportes", tags=["Soportes y Mantenimientos"])
app.include_router(actas_api.router, prefix="/api/actas", tags=["Actas Parciales"])
app.include_router(conformidad_api.router, prefix="/api/conformidad", tags=["Informes de Conformidad"])
app.include_router(catalogos_api.router, prefix="/api/catalogos", tags=["Catálogos"])
app.include_router(alertas_api.router, prefix="/api/alertas", tags=["Alertas de Vencimiento"])


def _job_verificacion_diaria():
    db = SessionLocal()
    try:
        alertas_service.ejecutar_verificacion_diaria(db)
    finally:
        db.close()


scheduler = BackgroundScheduler()


@app.on_event("startup")
def iniciar_scheduler_alertas():
    _job_verificacion_diaria()  # verificación inmediata al arrancar
    scheduler.add_job(_job_verificacion_diaria, "interval", hours=24, id="verificacion_alertas_tdr")
    scheduler.start()


@app.on_event("shutdown")
def detener_scheduler_alertas():
    scheduler.shutdown(wait=False)


@app.get("/")
def read_root():
    return {"mensaje": "Servidor del Sistema TDR del INAMHI funcionando. Rutas y CORS configurados exitosamente."}

# ==========================================================
# PUNTO DE ENTRADA Y CONFIGURACIÓN DEL PUERTO (PUERTO 8001)
# ==========================================================
import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)