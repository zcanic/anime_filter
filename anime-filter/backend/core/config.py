"""
Application configuration with environment-specific settings.
Reads from environment variables or uses sensible defaults.
Uses Pydantic v2 with ConfigDict for modern configuration management.
"""

import os
import sys
from pathlib import Path
from functools import lru_cache
from typing import Optional, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, computed_field, model_validator


class Settings(BaseSettings):
    """Application settings with environment-specific configurations."""

    # Environment
    environment: Literal["development", "testing", "production"] = Field(
        default="development",
        description="Application environment: development, testing, or production"
    )

    # Application
    app_name: str = Field(default="AnimePick Backend", description="Application name")
    app_version: str = Field(default="0.2.0", description="Application version")
    debug: bool = Field(default=False, description="Debug mode")

    # Paths configuration
    app_data_dir_override: Optional[str] = Field(
        default=None,
        description="Override application data directory (from ANIMEPICK_APP_DATA_DIR)"
    )

    # Database configuration
    database_max_connections: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Maximum database connections"
    )
    database_timeout_seconds: float = Field(
        default=30.0,
        ge=5.0,
        le=300.0,
        description="SQLite timeout in seconds"
    )

    # Cache configuration
    cache_max_size: int = Field(
        default=50000,
        ge=1000,
        le=1000000,
        description="Maximum number of items in LRU cache"
    )
    cache_stats_enabled: bool = Field(
        default=True,
        description="Enable cache statistics collection"
    )

    # API configuration
    api_rate_limit: str = Field(
        default="100/minute",
        description="API rate limit (e.g., '100/minute', '1000/hour')"
    )
    api_cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost",
            "http://localhost:1420",
            "http://127.0.0.1:1420",
            "tauri://localhost",
            "https://tauri.localhost",
        ],
        description="Allowed CORS origins"
    )
    api_request_timeout: int = Field(
        default=30,
        ge=5,
        le=300,
        description="API request timeout in seconds"
    )

    # Security configuration
    security_rate_limit_enabled: bool = Field(
        default=True,
        description="Enable API rate limiting"
    )
    security_cors_enabled: bool = Field(
        default=True,
        description="Enable CORS middleware"
    )
    security_log_sensitive_data: bool = Field(
        default=False,
        description="Log sensitive data (disabled in production)"
    )

    # Logging configuration
    log_level: str = Field(
        default="INFO",
        description="Logging level: DEBUG, INFO, WARNING, ERROR"
    )
    log_format: Literal["json", "console"] = Field(
        default="console",
        description="Log format: json for production, console for development"
    )
    log_request_id_enabled: bool = Field(
        default=True,
        description="Enable request ID tracking in logs"
    )

    # AI/ML Settings (for future use)
    model_device: str = Field(default="mps", description="AI model device (cpu, mps, cuda)")
    embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        description="Embedding model for AI features"
    )

    # Pydantic v2 configuration
    model_config = SettingsConfigDict(
        env_prefix="ANIMEPICK_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @computed_field
    @property
    def app_data_dir(self) -> Path:
        """Application data directory."""
        if self.app_data_dir_override:
            return Path(self.app_data_dir_override)

        # Environment-specific defaults
        if self.environment == "testing":
            return Path.cwd() / ".test_data"
        elif self.environment == "production":
            return Path.home() / "Library" / "Application Support" / "com.zcan.anime-filter"
        else:  # development
            return Path.cwd() / ".dev_data"

    @computed_field
    @property
    def database_path(self) -> Path:
        """Database file path."""
        return self.app_data_dir / "animepick.db"

    @computed_field
    @property
    def user_actions_csv(self) -> Path:
        """Legacy CSV path for migration."""
        return self.app_data_dir / "user_actions.csv"

    @computed_field
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == "development"

    @computed_field
    @property
    def is_testing(self) -> bool:
        """Check if running in testing environment."""
        return self.environment == "testing"

    @computed_field
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @model_validator(mode="after")
    def validate_settings(self) -> "Settings":
        """Validate settings after initialization."""
        # Ensure app data directory exists
        self.app_data_dir.mkdir(parents=True, exist_ok=True)

        # Adjust settings based on environment
        if self.is_production:
            # Production defaults
            if self.debug:
                self.debug = False
            if self.log_format == "console":
                self.log_format = "json"
            if self.security_log_sensitive_data:
                self.security_log_sensitive_data = False

        elif self.is_testing:
            # Testing defaults
            if not self.debug:
                self.debug = True

        return self

    def __str__(self) -> str:
        """String representation excluding sensitive data."""
        return f"Settings(environment={self.environment}, app_name={self.app_name}, debug={self.debug})"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
