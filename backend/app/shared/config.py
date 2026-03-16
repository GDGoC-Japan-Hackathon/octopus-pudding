from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/gdgoc"
    
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = True
    
    # Firebase
    firebase_project_id: str

    # Google Cloud Storage
    gcs_bucket_name: str = ""
    gcs_signed_url_expiration_seconds: int = 900

    # Google Places API
    google_places_api_key: str = ""
    google_places_endpoint: str = "https://places.googleapis.com/v1/places:searchText"
    google_places_language_code: str = "ja"
    google_places_region_code: str = "JP"

    # Gemini API
    gemini_api_key: str = ""
    gemini_api_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_model: str = "gemini-1.5-flash"
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings() 
