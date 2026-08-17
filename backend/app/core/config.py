import os

# Configuración SMTP institucional. Mientras SMTP_HOST no esté definido,
# el sistema registra las alertas en logs pero no intenta enviar correos reales.
SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER or "alertas-tdr@inamhi.gob.ec")

SMTP_CONFIGURADO = bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)

# Umbrales de alerta de vencimiento, en días restantes hasta fecha_finalizacion
UMBRALES_ALERTA = [90, 60, 30, 20, 7]
DIAS_BLOQUEO = 7
