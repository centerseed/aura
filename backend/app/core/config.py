"""Application configuration using Pydantic Settings.

This module provides environment-based configuration for the Aura Backend.
All settings are loaded from environment variables or .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Environment variables should be defined in .env file or system environment.
    """

    # Gemini LLM Configuration
    gemini_api_key: str
    gemini_model: str = "gemini-2.0-flash-exp"

    # Firebase Configuration
    firebase_project_id: str = "aura-business-os"
    google_application_credentials: str = "service-account.json"

    # Application Settings
    env: Literal["local", "staging", "production"] = "local"
    debug: bool = True
    port: int = 8080

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )


# Global settings instance
settings = Settings()
