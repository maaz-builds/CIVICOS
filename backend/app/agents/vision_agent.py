"""Vision agent - identifies civic issues from photos AND videos.

Images go straight to the vision model. Videos are sampled into a few
evenly spaced frames, each frame is analyzed by the same model, and the
frame results are aggregated into ONE unified analysis:

  * issue_type: majority vote (ties broken by total confidence)
  * severity:   majority vote among frames that named one
  * confidence: highest confidence across frames
  * description: deduped combination of the per-frame descriptions

Frame extraction uses OpenCV (opencv-python-headless) - no ffmpeg binary
required, safe on servers/Vercel. ``analyze()`` dispatches on the upload's
content type, so callers (route/workflow) pass the MIME and get the right
path automatically; the image path is unchanged from before.
"""

import json
import os
import re
import tempfile

import cv2

from app.services.featherless_service import FeatherlessService

# Number of frames sampled evenly across a video ("3-5 representative
# frames"; 3 keeps the model calls fast enough for a hackathon demo).
_VIDEO_FRAMES = 3

# Frames are downscaled to this max edge before being sent to the model: a
# 4K frame base64-encoded is ~10 MB and slows the vision call massively;
# 1280px keeps detail while keeping latency sane.
_MAX_FRAME_EDGE = 1280

# Severity values the model may return (used for the majority vote).
_SEVERITY_LEVELS = {"low", "medium", "high", "critical"}


def _extract_json(text: str) -> dict:
    """Parse the model's reply, tolerating markdown fences and stray text.

    The vision model is instructed to return only JSON, but models
    occasionally wrap it in ```json fences or add a trailing word. Without
    this, every such reply turned into a 502 for the user.
    """
    cleaned = text.strip()
    # Strip ```json ... ``` fences if present.
    fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, re.DOTALL)
    if fenced:
        cleaned = fenced.group(1)
    else:
        # Fall back to the first {...} block in the reply.
        first_brace = cleaned.find("{")
        last_brace = cleaned.rfind("}")
        if first_brace != -1 and last_brace > first_brace:
            cleaned = cleaned[first_brace : last_brace + 1]
    return json.loads(cleaned)


class VisionAgent:
    def __init__(self):
        self.ai = FeatherlessService()

    async def analyze(self, image_path: str, content_type: str = "image/jpeg"):
        """Analyze the uploaded media: image or video, picked from MIME.

        Keeps the exact image behavior from before - video/* content types
        are routed to ``analyze_video`` instead.
        """
        if (content_type or "").startswith("video/"):
            return await self.analyze_video(image_path)
        return await self._analyze_single_image(
            image_path, content_type or "image/jpeg"
        )

    async def _analyze_single_image(
        self, image_path: str, content_type: str = "image/jpeg"
    ) -> dict:
        """The original image analysis path (unchanged behavior)."""
        prompt = """
You are the Vision Agent for CivicFix.

Analyze the uploaded image and identify ONLY one civic issue.

Possible classes:
- Pothole
- Garbage
- Broken Streetlight
- Water Leakage
- Open Manhole
- Fallen Tree
- Other

Return ONLY valid JSON in this exact format:

{
  "issue_type": "",
  "confidence": 0.0,
  "severity": "",
  "description": ""
}

- confidence must be a number between 0.0 and 1.0.
- Severity must be one of: Low, Medium, High, Critical.
"""

        result = await self.ai.analyze_image(image_path, prompt, content_type)

        return _extract_json(result)

    async def analyze_video(self, video_path: str) -> dict:
        """Analyze a video: sample frames, analyze each, aggregate results.

        Returns the SAME schema as the image path -
        ``{issue_type, confidence, severity, description}`` - so callers
        cannot tell the input type apart.

        Raises ValueError with a readable message when the video cannot be
        decoded (corrupted file / unsupported codec), which the route maps
        to a clean HTTP error.
        """
        frame_paths = self._extract_frames(video_path)
        if not frame_paths:
            raise ValueError(
                "Could not read the video - it may be corrupted or use an "
                "unsupported codec. Try a different file or upload an image "
                "instead."
            )

        try:
            analyses: list[dict] = []
            errors: list[Exception] = []
            for frame in frame_paths:
                try:
                    analyses.append(
                        await self._analyze_single_image(frame, "image/jpeg")
                    )
                except Exception as exc:  # noqa: BLE001 - collect per-frame
                    errors.append(exc)

            if not analyses:
                # Every frame failed - propagate the first error so the
                # route's 502/503 mapping kicks in.
                raise errors[0]

            return self._aggregate_frames(analyses)
        finally:
            for frame in frame_paths:
                try:
                    # Frames are temp files; never leave them behind.
                    os.unlink(frame)
                except OSError:
                    pass

    # ------------------------------------------------------------------
    # Frame extraction
    # ------------------------------------------------------------------

    def _extract_frames(self, video_path: str) -> list[str]:
        """Sample ``_VIDEO_FRAMES`` frames evenly across the video.

        Returns a list of temp JPEG paths (caller cleans them up). An empty
        list means the video could not be decoded.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return []

        try:
            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if total <= 0:
                # Some codecs (e.g. webm) report 0 frames; read them all.
                total = self._count_frames(cap)
            if total <= 0:
                return []

            count = min(_VIDEO_FRAMES, total)
            indices = {0}
            if count > 1:
                indices = {
                    round(i * (total - 1) / (count - 1)) for i in range(count)
                }

            frames: list[str] = []
            for idx in sorted(indices):
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ok, frame = cap.read()
                if ok and frame is not None:
                    path = self._save_frame(frame)
                    if path:
                        frames.append(path)
            return frames
        finally:
            cap.release()

    def _count_frames(self, cap) -> int:
        """Fallback frame count: iterate until EOF (with a safety cap)."""
        total = 0
        while total < 100_000:
            ok, _ = cap.read()
            if not ok:
                break
            total += 1
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        return total

    def _save_frame(self, frame) -> str | None:
        """Downscale a frame and write it to a temp JPEG; returns its path."""
        h, w = frame.shape[:2]
        largest = max(h, w)
        if largest > _MAX_FRAME_EDGE:
            scale = _MAX_FRAME_EDGE / largest
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            path = tmp.name
        ok = cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not ok:
            try:
                os.unlink(path)
            except OSError:
                pass
            return None
        return path

    # ------------------------------------------------------------------
    # Aggregation
    # ------------------------------------------------------------------

    def _aggregate_frames(self, analyses: list[dict]) -> dict:
        """Combine per-frame analyses into one unified result.

        * issue_type: majority vote; ties broken by total confidence
        * severity: majority vote among frames that named a valid level
        * confidence: highest confidence across the frames
        * description: deduped combination, most confident frame first

        Values vote case-insensitively ("high" == "High") and the winning
        value is title-cased, matching the documented output format.
        """
        def vote(key: str, allowed: set[str] | None = None) -> str | None:
            counts: dict[str, int] = {}
            confidence_sum: dict[str, float] = {}
            for analysis in analyses:
                value = str(analysis.get(key) or "").strip()
                if not value:
                    continue
                # Vote on a canonical (title-cased) key so "high"/"High"/
                # "HIGH" count as one; the vision categories are
                # title-cased anyway, so the output spelling is unchanged.
                canonical = value.title()
                if allowed is not None and canonical.lower() not in allowed:
                    continue
                counts[canonical] = counts.get(canonical, 0) + 1
                confidence_sum[canonical] = (
                    confidence_sum.get(canonical, 0)
                    + float(analysis.get("confidence") or 0)
                )
            if not counts:
                return None
            top = max(counts, key=counts.get)
            max_votes = counts[top]
            tied = [v for v, c in counts.items() if c == max_votes]
            # Tie-break by total confidence among the tied values.
            return max(tied, key=lambda v: confidence_sum[v])

        issue_type = vote("issue_type") or "Other"
        severity = vote("severity", _SEVERITY_LEVELS)

        confidence = max(
            float(a.get("confidence") or 0) for a in analyses
        )
        # Clamp to the documented 0..1 scale.
        confidence = min(max(confidence, 0.0), 1.0)

        # Combine descriptions: most confident frame first, deduped.
        descriptions: list[str] = []
        for analysis in sorted(
            analyses,
            key=lambda a: float(a.get("confidence") or 0),
            reverse=True,
        ):
            desc = str(analysis.get("description") or "").strip()
            if desc and desc not in descriptions:
                descriptions.append(desc)
        description = " ".join(descriptions)[:500] or "No description provided."

        return {
            "issue_type": issue_type,
            "confidence": confidence,
            "severity": severity,
            "description": description,
        }