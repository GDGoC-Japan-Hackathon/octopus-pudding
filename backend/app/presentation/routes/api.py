from fastapi import APIRouter
from app.presentation.controllers.user_controller import router as user_router
from app.presentation.controllers.auth_controller import router as auth_router
from app.presentation.controllers.trip_controller import router as trip_router
from app.presentation.controllers.trip_day_controller import router as trip_day_router
from app.presentation.controllers.trip_incident_replan_controller import (
    router as trip_incident_replan_router,
)
from app.presentation.controllers.trip_member_controller import router as trip_member_router
from app.presentation.controllers.trip_preference_controller import router as trip_preference_router
from app.presentation.controllers.trip_ai_plan_controller import router as trip_ai_plan_router
from app.presentation.controllers.friend_controller import router as friend_router
from app.presentation.controllers.recommendation_controller import router as recommendation_router

api_router = APIRouter()

# Include user routes
api_router.include_router(user_router, prefix="/users", tags=["users"])

# Include friend routes
api_router.include_router(friend_router, prefix="/users", tags=["friends"])

# Include auth routes
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])

# Include trip routes
api_router.include_router(trip_router, prefix="/trips", tags=["trips"])

# Include trip preference routes
api_router.include_router(trip_preference_router, prefix="/trips", tags=["trip-preferences"])

# Include trip member routes
api_router.include_router(trip_member_router, prefix="/trips", tags=["trip-members"])

# Include trip day / itinerary routes
api_router.include_router(trip_day_router, prefix="/trips", tags=["trip-days"])

# Include incident / replan routes
api_router.include_router(
    trip_incident_replan_router,
    prefix="/trips",
    tags=["trip-incidents-replans"],
)

# Include AI plan generation routes
api_router.include_router(
    trip_ai_plan_router,
    prefix="/trips",
    tags=["trip-ai-plan"],
)

# Include recommendation routes
api_router.include_router(recommendation_router, prefix="/recommendations", tags=["recommendations"])
