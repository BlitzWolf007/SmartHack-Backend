from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator
from typing import List

class Settings(BaseSettings):
    SECRET_KEY: str = "change-me-please"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    DATABASE_URL: str = "sqlite:///./office.db"
    ENV: str = "dev"
    CORS_ORIGINS: str | None = None  # comma-separated

    @property
    def origins(self) -> List[str]:
        if self.CORS_ORIGINS:
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        # default: allow localhost/127.0.0.1 on any port
        return []

settings = Settings(_env_file=".env", _env_file_encoding="utf-8", _secrets_dir=None)
