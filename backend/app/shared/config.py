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
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings() 
