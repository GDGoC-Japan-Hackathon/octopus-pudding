from fastapi import APIRouter
from app.presentation.controllers.user_controller import router as user_router
from app.presentation.controllers.auth_controller import router as auth_router
from app.presentation.controllers.trip_controller import router as trip_router

api_router = APIRouter()

# Include user routes
api_router.include_router(user_router, prefix="/users", tags=["users"])

# Include auth routes
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])

# Include trip routes
api_router.include_router(trip_router, prefix="/trips", tags=["trips"])
