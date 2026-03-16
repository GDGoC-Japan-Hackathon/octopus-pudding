import logging
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import BinaryIO, Optional
from uuid import uuid4

from google.auth import default as google_auth_default
from google.api_core.exceptions import NotFound
from google.cloud import storage

from app.shared.config import settings

logger = logging.getLogger(__name__)


@dataclass
class UploadedObject:
    bucket: str
    object_path: str
    content_type: str

    @property
    def gs_uri(self) -> str:
        return f"gs://{self.bucket}/{self.object_path}"

    @property
    def object_url(self) -> str:
        return f"https://storage.googleapis.com/{self.bucket}/{self.object_path}"


class CloudStorageClient:
    """Google Cloud Storage access wrapper."""

    def __init__(
        self,
        bucket_name: Optional[str] = None,
        client: Optional[storage.Client] = None,
    ) -> None:
        resolved_bucket = bucket_name or settings.gcs_bucket_name
        if not resolved_bucket:
            raise ValueError("GCS bucket name is not configured")

        self.bucket_name = resolved_bucket
        self.credentials = None
        self.project_id = None

        if client is not None:
            self.client = client
            self.credentials = getattr(client, "_credentials", None)
            self.project_id = getattr(client, "project", None)
        else:
            project_id = None
            creds = None
            try:
                creds, default_project = google_auth_default()
                project_id = default_project
            except Exception as exc:
                logger.warning("failed to load GCP ADC credentials: %s", exc)

            self.credentials = creds
            self.project_id = project_id
            self.client = storage.Client(project=project_id, credentials=creds)

        self.bucket = self.client.bucket(self.bucket_name)
        logger.info(
            "cloud storage client initialized: bucket=%s project=%s creds=%s",
            self.bucket_name,
            self.project_id,
            type(self.credentials).__name__ if self.credentials is not None else "None",
        )

    def upload_profile_image(
        self,
        file: BinaryIO,
        user_id: int,
        original_filename: str,
        content_type: str,
    ) -> UploadedObject:
        """Upload profile image to a user-specific path."""
        extension = Path(original_filename).suffix.lower()
        object_path = f"profiles/{user_id}/{uuid4().hex}{extension}"
        blob = self.bucket.blob(object_path)
        logger.info(
            "uploading profile image to GCS: bucket=%s object_path=%s content_type=%s",
            self.bucket_name,
            object_path,
            content_type,
        )
        try:
            blob.upload_from_file(file, content_type=content_type)
        except Exception:
            logger.exception(
                "GCS upload failed: bucket=%s object_path=%s user_id=%s",
                self.bucket_name,
                object_path,
                user_id,
            )
            raise

        return UploadedObject(
            bucket=self.bucket_name,
            object_path=object_path,
            content_type=content_type,
        )

    def generate_download_signed_url(self, object_path: str) -> str:
        """Generate a short-lived V4 signed URL for private objects."""
        blob = self.bucket.blob(object_path)
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(seconds=settings.gcs_signed_url_expiration_seconds),
            method="GET",
        )

    def generate_upload_signed_url(
        self,
        object_path: str,
        content_type: str,
    ) -> str:
        """Generate a short-lived V4 signed URL for direct client uploads."""
        blob = self.bucket.blob(object_path)
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(seconds=settings.gcs_signed_url_expiration_seconds),
            method="PUT",
            content_type=content_type,
        )

    def download_object(self, object_path: str) -> tuple[bytes, str]:
        """Download private object bytes and return (content, content_type)."""
        blob = self.bucket.blob(object_path)
        try:
            content = blob.download_as_bytes()
        except NotFound:
            logger.info(
                "GCS object not found: bucket=%s object_path=%s",
                self.bucket_name,
                object_path,
            )
            raise

        content_type = blob.content_type or "application/octet-stream"
        return content, content_type
