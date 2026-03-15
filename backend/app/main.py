from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.shared.config import settings
from app.presentation.routes.api import api_router

app = FastAPI(
    title="hutatabi",
    description="hutatabi trip plan app",
    version="0.1.0",
    debug=settings.debug
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Welcome to hutatabi trip plan app"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"} 
