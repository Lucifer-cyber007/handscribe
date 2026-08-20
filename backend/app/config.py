"""
Startup configuration and environment validation.

Fails fast and loudly if required env vars are missing or invalid, rather
than letting a request handler blow up deep in the call stack later.
"""
import os
import sys

from dotenv import load_dotenv

load_dotenv()


class ConfigError(RuntimeError):
    pass


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value or not value.strip():
        raise ConfigError(
            f"Missing required environment variable '{name}'. "
            f"Copy backend/.env.example to backend/.env and fill it in."
        )
    return value.strip()


class Settings:
    def __init__(self) -> None:
        self.llm_provider: str = os.getenv("LLM_PROVIDER", "groq").strip().lower()
        if self.llm_provider not in ("groq", "gemini", "vertex"):
            raise ConfigError(
                f"Unknown LLM_PROVIDER '{self.llm_provider}'. Supported: groq, gemini, vertex."
            )

        # All provider settings are read (not required) regardless of which
        # one is active, so switching LLM_PROVIDER doesn't require re-adding
        # the others later — only the currently-selected provider's settings
        # are actually enforced at startup.
        self.groq_api_key: str | None = os.getenv("GROQ_API_KEY")
        self.groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        # Groq's tokens-per-minute limit varies significantly by account,
        # and this counts against it up front — keep it just big enough for
        # the model in use (see GROQ_MODEL comment in .env.example).
        self.groq_max_completion_tokens: int = int(
            os.getenv("GROQ_MAX_COMPLETION_TOKENS", "4096")
        )
        self.gemini_api_key: str | None = os.getenv("GEMINI_API_KEY")
        self.gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
        self.vertex_project_id: str | None = os.getenv("GOOGLE_VERTEX_PROJECT_ID")
        self.vertex_location: str = os.getenv("GOOGLE_VERTEX_LOCATION", "us-central1")
        self.vertex_model: str = os.getenv("GOOGLE_VERTEX_MODEL", "gemini-2.0-flash-001")
        self.google_application_credentials: str | None = os.getenv(
            "GOOGLE_APPLICATION_CREDENTIALS"
        )

        if self.llm_provider == "groq" and not self.groq_api_key:
            raise ConfigError(
                "LLM_PROVIDER=groq requires GROQ_API_KEY to be set in backend/.env."
            )
        if self.llm_provider == "gemini" and not self.gemini_api_key:
            raise ConfigError(
                "LLM_PROVIDER=gemini requires GEMINI_API_KEY to be set in backend/.env "
                "(get one from https://aistudio.google.com/apikey)."
            )
        if self.llm_provider == "vertex":
            if not self.vertex_project_id:
                raise ConfigError(
                    "LLM_PROVIDER=vertex requires GOOGLE_VERTEX_PROJECT_ID to be set "
                    "in backend/.env."
                )
            if not self.google_application_credentials:
                raise ConfigError(
                    "LLM_PROVIDER=vertex requires GOOGLE_APPLICATION_CREDENTIALS to point "
                    "at a Vertex AI service account JSON key file."
                )
            if not os.path.isfile(self.google_application_credentials):
                raise ConfigError(
                    "GOOGLE_APPLICATION_CREDENTIALS points to "
                    f"'{self.google_application_credentials}', but no file exists there."
                )

        self.google_vision_api_key: str = _require("GOOGLE_VISION_API_KEY")

        # Translate PDF is an optional add-on tool, not core to the app, so
        # unlike the settings above it's not enforced at startup — a request
        # to /api/pdf/translate just returns a clear error if these are unset.
        self.google_translate_project_id: str | None = os.getenv("GOOGLE_TRANSLATE_PROJECT_ID")
        self.google_translate_credentials: str | None = os.getenv("GOOGLE_TRANSLATE_CREDENTIALS")

        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./pdfboii.db")
        self.cors_origins: list[str] = [
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
            if origin.strip()
        ]
        self.ocr_provider: str = os.getenv("OCR_PROVIDER", "google_vision")
        self.max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "10"))

        # Word<->PDF conversion shells out to LibreOffice headless. Optional
        # like the Translate settings above — if unset, office_ops auto-
        # detects `soffice` on PATH (the case in Docker/Linux) or the default
        # Windows install location, and only errors at request time if
        # neither is found.
        self.libreoffice_path: str | None = os.getenv("LIBREOFFICE_PATH")

        # AI Summarizer deliberately always calls Groq's openai/gpt-oss-120b
        # directly, regardless of LLM_PROVIDER above (a fixed choice for
        # this one tool, not the app's configurable extraction provider).
        # Optional like the settings above — only enforced at request time.
        self.groq_summarizer_max_completion_tokens: int = int(
            os.getenv("GROQ_SUMMARIZER_MAX_COMPLETION_TOKENS", "2048")
        )

        # Signs session JWTs. Unlike GOOGLE_VISION_API_KEY above, a missing
        # value here shouldn't block every unauthenticated tool from booting
        # in a fresh checkout — auth is a separable feature — so this falls
        # back to an obviously-fake dev value instead of failing startup.
        # MUST be overridden with a real random value before any non-local use.
        self.session_secret: str = os.getenv("SESSION_SECRET", "dev-insecure-secret-change-me")

        # Google Sign-In is optional — checked at request time inside
        # routers/auth.py, same pattern as the Translate PDF settings above.
        # Email/password auth works regardless of whether this is set.
        self.google_oauth_client_id: str | None = os.getenv("GOOGLE_OAUTH_CLIENT_ID")


def load_settings() -> Settings:
    try:
        return Settings()
    except ConfigError as exc:
        sys.stderr.write(f"\n[PDFBoii backend] Startup configuration error:\n  {exc}\n\n")
        raise SystemExit(1) from exc


settings = load_settings()
