import logging
import smtplib
from email.mime.text import MIMEText
from datetime import date
from sqlalchemy.orm import Session

from app.core import config
from app.models.tdr import TDR
from app.models.user import Usuario
from app.models.notificacion import Notificacion

logger = logging.getLogger("alertas_tdr")


def dias_restantes(tdr: TDR, hoy: date | None = None) -> int:
    hoy = hoy or date.today()
    return (tdr.fecha_finalizacion - hoy).days


def nivel_alerta(dias: int) -> int | None:
    """Devuelve el umbral de alerta más urgente alcanzado (90/60/30/20/7), o None si no aplica."""
    if dias < 0:
        return None
    for umbral in sorted(config.UMBRALES_ALERTA):
        if dias <= umbral:
            return umbral
    return None


def esta_bloqueado(tdr: TDR, hoy: date | None = None) -> bool:
    hoy = hoy or date.today()
    dias = dias_restantes(tdr, hoy)
    return 0 <= dias <= config.DIAS_BLOQUEO and (tdr.estado or "").lower() not in ("anulado", "vencido")


def enviar_correo(destinatarios: list[str], asunto: str, cuerpo: str) -> bool:
    if not config.SMTP_CONFIGURADO:
        logger.info("[ALERTA TDR - correo NO enviado, SMTP no configurado] Para: %s | %s\n%s",
                    destinatarios, asunto, cuerpo)
        return False

    mensaje = MIMEText(cuerpo, "plain", "utf-8")
    mensaje["Subject"] = asunto
    mensaje["From"] = config.SMTP_FROM
    mensaje["To"] = ", ".join(destinatarios)

    try:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as servidor:
            servidor.starttls()
            servidor.login(config.SMTP_USER, config.SMTP_PASSWORD)
            servidor.sendmail(config.SMTP_FROM, destinatarios, mensaje.as_string())
        return True
    except Exception:
        logger.exception("Fallo al enviar correo de alerta a %s", destinatarios)
        return False


def construir_resumen_tdr(tdr: TDR, dias: int) -> str:
    return (
        f"TDR: {tdr.numero_tdr}\n"
        f"Tarea: {tdr.nombre_tarea}\n"
        f"Tipo de proceso: {tdr.tipo_proceso}\n"
        f"Dirección solicitante: {tdr.direccion_solicitante}\n"
        f"Responsable: {tdr.responsable_designado}\n"
        f"Presupuesto codificado: {tdr.presupuesto_codificado}\n"
        f"Período de contrato: {tdr.periodo_contrato}\n"
        f"Fecha de inicio: {tdr.fecha_inicio}\n"
        f"Fecha de finalización: {tdr.fecha_finalizacion}\n"
        f"Estado actual: {tdr.estado}\n"
        f"Días restantes: {dias}\n"
    )


def ejecutar_verificacion_diaria(db: Session):
    """Recorre los TDR activos, actualiza su estado si venció, y envía/registra
    las alertas de los umbrales alcanzados que aún no se hayan notificado."""
    hoy = date.today()
    tdrs = db.query(TDR).filter(TDR.estado.notin_(["Anulado", "Vencido"])).all()
    destinatarios = [
        u.username for u in db.query(Usuario).filter(Usuario.activo == True).all()  # noqa: E712
        if "@" in u.username
    ] or None

    for tdr in tdrs:
        dias = dias_restantes(tdr, hoy)

        if dias < 0:
            tdr.estado = "Vencido"
            db.commit()
            continue

        nivel = nivel_alerta(dias)
        if nivel is None:
            continue

        ya_notificado = (
            db.query(Notificacion)
            .filter(Notificacion.tdr_id == tdr.id, Notificacion.nivel_alerta == nivel)
            .first()
        )
        if ya_notificado:
            continue

        asunto = f"[Alerta TDR INAMHI] {tdr.numero_tdr} vence en {dias} día(s)"
        cuerpo = construir_resumen_tdr(tdr, dias)
        enviar_correo(destinatarios or [config.SMTP_FROM], asunto, cuerpo)

        db.add(Notificacion(tdr_id=tdr.id, nivel_alerta=nivel))
        db.commit()


def verificar_password_admin(db: Session, password: str) -> bool:
    from app.core.security import verificar_contrasena

    directores = db.query(Usuario).filter(Usuario.role == "director", Usuario.activo == True).all()  # noqa: E712
    return any(verificar_contrasena(password, d.password_hash) for d in directores)
