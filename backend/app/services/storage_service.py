"""File/image storage (NOT connected yet).

Future role: upload complaint photos to Supabase Storage and return public
URLs, so routes and agents never touch storage APIs directly.

Not installed yet on purpose (see requirements.txt).
"""


class StorageService:
    """Photo storage wrapper (implement later)."""

    async def upload_image(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> str:
        """Upload a photo and return its public URL.

        TODO(upload milestone): use Supabase Storage once the SDK is added.
        """
        raise NotImplementedError(
            "StorageService.upload_image is not implemented yet."
        )
