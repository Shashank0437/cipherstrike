from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_uri: str = "mongodb://127.0.0.1:27017"
    database_name: str = "hexstrike"
    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:3000"

    # Single operator (env-based). No DB registration; login only accepts these.
    operator_email: str = "operator@cipherstrike.local"
    # Comma-separated; same password as above (e.g. rebrand: operator@hexstrike.local)
    operator_email_aliases: str = "operator@hexstrike.local"
    operator_password: str = "change-me"
    operator_user_id: str = "000000000000000000000001"


settings = Settings()
