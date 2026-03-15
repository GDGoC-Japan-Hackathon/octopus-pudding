from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/gdgoc"
    
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = True
    
    # Security
    secret_key: str = "your-secret-key-here"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Firebase
    firebase_project_id: str | None = None
    firebase_credentials_path: str | None = None
    firebase_credentials_json: str | None = None
    firebase_check_revoked: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings() 
