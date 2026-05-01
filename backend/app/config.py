import os
import ssl
import certifi
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic_settings import BaseSettings, SettingsConfigDict

ssl_context = ssl.create_default_context(cafile=certifi.where())


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    REDIS_URL: str
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int = 587
    MAIL_SERVER: str
    MAIL_FROM_NAME: str
    DOMAIN: str
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    DEBUG: bool = False

    VALIDATE_CERTS: bool= False
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    )

    @property
    def database_url_with_neon_ssl(self) -> str:
        parsed = urlparse(self.DATABASE_URL)
        query_params = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query_params["sslmode"] = "require"
        return urlunparse(parsed._replace(query=urlencode(query_params)))

    @property
    def async_database_url(self) -> str:
        parsed = urlparse(self.database_url_with_neon_ssl)
        query_params = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query_params.pop("sslmode", None)
        return urlunparse(parsed._replace(query=urlencode(query_params)))

    @property
    def sanitized_database_target(self) -> str:
        parsed = urlparse(self.database_url_with_neon_ssl)
        return f"host={parsed.hostname}, db={parsed.path.lstrip('/')}"


settings = Settings()
