from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import BinaryIO, Optional
from uuid import uuid4

from google.cloud import storage

from app.shared.config import settings


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
        self.client = client or storage.Client()
        self.bucket = self.client.bucket(self.bucket_name)

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
        blob.upload_from_file(file, content_type=content_type)

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
