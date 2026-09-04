"""Supabase Storage - complaint photo uploads.

Replaces the original stub: photos are uploaded to a **public** Supabase
Storage bucket and linked to the complaint row via ``image_url``. The bucket
and its demo-grade RLS policies are created by ``backend/supabase/schema.sql``
(second section), so run that file once in the Supabase SQL editor.

No extra dependency is needed: the ``supabase`` package already bundles the
storage client, exposed as ``client.storage``.
"""

import uuid
from pathlib import Path

from app.config import settings
from app.services.supabase_service import SupabaseService


class StorageService:
    """Photo storage wrapper around Supabase Storage."""

    def __init__(self, db: SupabaseService | None = None):
        # Reuse the same lazy client as SupabaseService so credentials are
        # configured in exactly one place.
        self._db = db or SupabaseService()

    @property
    def client(self):
        """Build (once) and return the Supabase client (storage included)."""
        return self._db.client

    async def upload_image(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> str:
        """Upload a photo to the public bucket and return its public URL.

        The object path is namespaced under ``complaints/<uuid>`` so every
        report gets its own unique object and filenames never collide.
        """
        bucket = settings.SUPABASE_STORAGE_BUCKET

        # Keep the original extension (default to .jpg) - storage needs one
        # to serve the right content type on GET.
        suffix = Path(filename or "").suffix.lower()
        if not suffix.startswith(".") or len(suffix) > 5:
            suffix = ".jpg"
        object_path = f"complaints/{uuid.uuid4()}{suffix}"

        try:
            self.client.storage.from_(bucket).upload(
                object_path,
                file_bytes,
                {"content-type": content_type or "image/jpeg"},
            )
        except Exception as exc:  # noqa: BLE001 - surface a clean setup error
            raise RuntimeError(
                f"Could not store photo in Supabase Storage bucket "
                f"'{bucket}': {exc}. Make sure backend/supabase/schema.sql "
                "has been run (it creates the bucket + upload policies) and "
                "that SUPABASE_URL / SUPABASE_ANON_KEY are set."
            ) from exc

        return self.client.storage.from_(bucket).get_public_url(object_path)