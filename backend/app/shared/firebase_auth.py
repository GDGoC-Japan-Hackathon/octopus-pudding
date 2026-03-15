import json
from functools import lru_cache

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from app.shared.config import settings


@lru_cache(maxsize=1)
def get_firebase_app():
    """Initialize and return Firebase Admin app singleton."""
    if firebase_admin._apps:
        return firebase_admin.get_app()

    cred = None
    if settings.firebase_credentials_json:
        cred = credentials.Certificate(json.loads(settings.firebase_credentials_json))
    elif settings.firebase_credentials_path:
        cred = credentials.Certificate(settings.firebase_credentials_path)
    else:
        cred = credentials.ApplicationDefault()

    options = {}
    if settings.firebase_project_id:
        options["projectId"] = settings.firebase_project_id

    return firebase_admin.initialize_app(cred, options or None)


def verify_firebase_id_token(id_token: str) -> dict:
    """Verify Firebase ID token and return decoded claims."""
    app = get_firebase_app()
    return firebase_auth.verify_id_token(
        id_token,
        app=app,
        check_revoked=settings.firebase_check_revoked,
    )
