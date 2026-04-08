from asgiref.sync import async_to_sync
from celery.utils.log import get_task_logger
from backend.app.celery_app import celery_app
from backend.app.auth.mail import mail, create_message
from backend.app.config import settings

logger = get_task_logger(__name__)


@celery_app.task(name="send_email_verification", bind=True, max_retries=3)
def send_email_verification_task(self, email: str, token: str):
    link = f"http://{settings.DOMAIN}/auth/verify/{token}"
    html = f"""
    <h2>Verify Your Email</h2>
    <p><a href="{link}">Click here to verify your account</a></p>
    <p>Link expires in 1 hour.</p>
    """
    try:
        message = create_message([email], "Verify your email", html)
        async_to_sync(mail.send_message)(message)
        logger.info("Verification email sent to %s", email)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=10)


@celery_app.task(name="send_password_reset", bind=True, max_retries=3)
def send_password_reset_task(self, email: str, token: str):
    link = f"http://{settings.DOMAIN}/auth/password-reset-confirm/{email}/{token}"
    html = f"""
    <h2>Reset Your Password</h2>
    <p><a href="{link}">Click here to reset your password</a></p>
    <p>Link expires in 30 minutes.</p>
    """
    try:
        message = create_message([email], "Reset your password", html)
        async_to_sync(mail.send_message)(message)
        logger.info("Password reset email sent to %s", email)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=10)


@celery_app.task(name="send_password_changed_notification", bind=True, max_retries=3)
def send_password_changed_notification_task(self, email: str):
    html = """
    <h2>Password Changed</h2>
    <p>Your password has been successfully changed.</p>
    <p>If you did not make this change, please reset your password immediately or contact support.</p>
    """
    try:
        message = create_message([email], "Your password was changed", html)
        async_to_sync(mail.send_message)(message)
        logger.info("Password changed notification sent to %s", email)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=10)