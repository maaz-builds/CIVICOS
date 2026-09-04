"""Featherless AI integration (NOT connected yet).

Future role: the ONLY place in the codebase that talks to Featherless AI, so
agents never call the provider directly. It will expose simple helpers such
as chat completion and vision analysis (Featherless exposes OpenAI-compatible
endpoints).

The Featherless SDK is intentionally NOT installed yet (see requirements.txt).
"""


class FeatherlessService:
    """Thin wrapper around the Featherless AI API (implement later)."""

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        model: str = "default",
    ) -> str:
        """Return the model's text reply.

        TODO(AI milestone): call Featherless with the configured API key,
        model name, and timeouts; handle errors centrally here.
        """
        raise NotImplementedError(
            "FeatherlessService.chat_completion is not implemented yet."
        )

    async def analyze_image(self, image_url: str, prompt: str) -> str:
        """Return the model's analysis of an image.

        TODO(AI milestone): vision call used by the vision agent.
        """
        raise NotImplementedError(
            "FeatherlessService.analyze_image is not implemented yet."
        )
