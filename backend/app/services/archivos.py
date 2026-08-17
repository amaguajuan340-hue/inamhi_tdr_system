import os
import uuid
from fastapi import UploadFile, HTTPException

CARPETA_UPLOADS = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(CARPETA_UPLOADS, exist_ok=True)

EXTENSIONES_PERMITIDAS = {".pdf"}
TAMANO_MAXIMO_BYTES = 15 * 1024 * 1024  # 15 MB


def guardar_pdf(archivo: UploadFile, tdr_id: int) -> tuple[str, str]:
    """Valida y guarda un PDF en disco bajo uploads/tdr_{id}/. Devuelve (nombre_original, ruta_relativa)."""
    nombre_original = archivo.filename or "documento.pdf"
    _, ext = os.path.splitext(nombre_original)
    if ext.lower() not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    contenido = archivo.file.read()
    if len(contenido) > TAMANO_MAXIMO_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera el tamaño máximo permitido (15 MB)")

    carpeta_tdr = os.path.join(CARPETA_UPLOADS, f"tdr_{tdr_id}")
    os.makedirs(carpeta_tdr, exist_ok=True)

    nombre_unico = f"{uuid.uuid4().hex}{ext.lower()}"
    ruta_absoluta = os.path.join(carpeta_tdr, nombre_unico)
    with open(ruta_absoluta, "wb") as f:
        f.write(contenido)

    ruta_relativa = os.path.join(f"tdr_{tdr_id}", nombre_unico)
    return nombre_original, ruta_relativa


def ruta_completa(ruta_relativa: str) -> str:
    return os.path.join(CARPETA_UPLOADS, ruta_relativa)
