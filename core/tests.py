import base64
import os
from unittest.mock import patch

from django.test import TestCase, override_settings


PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMBAf6Xn5sAAAAASUVORK5CYII="
)
VIDEO_DATA_URL = "data:video/webm;base64," + base64.b64encode(b"fake-webm-data").decode("ascii")


@override_settings(CAP_ANIME_MEDIA_ROOT="/tmp/bab-industries-cap-anime-tests")
class CapAnimeApiSmokeTests(TestCase):
    def setUp(self):
        self.client.defaults["HTTP_HOST"] = "testserver"

    def tearDown(self):
        root = "/tmp/bab-industries-cap-anime-tests"
        if os.path.isdir(root):
            for folder, _, files in os.walk(root, topdown=False):
                for name in files:
                    try:
                        os.remove(os.path.join(folder, name))
                    except OSError:
                        pass
                try:
                    os.rmdir(folder)
                except OSError:
                    pass

    @patch("core.views._pollinations_image")
    @patch("core.views._azure_openai_image")
    def test_generate_image_smoke(self, mock_azure, mock_pollinations):
        mock_azure.return_value = (None, {"ok": False, "error": "unconfigured"}, 503)
        mock_pollinations.return_value = (PNG_DATA_URL, None, 200)

        response = self.client.post(
            "/api/cap-anime/generate-image/",
            data={"prompt": "anime hero", "aspect": "16:9", "model": "flux"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload.get("ok"))
        self.assertTrue(str(payload.get("image", "")).startswith("data:image/"))
        self.assertTrue(str(payload.get("imageUrl", "")).startswith("/api/cap-anime/media/images/"))

        media_response = self.client.get(payload["imageUrl"])
        self.assertEqual(media_response.status_code, 200)
        self.assertEqual(media_response["Cache-Control"], "public, max-age=604800")

    @patch("core.views._post_json")
    def test_generate_video_provider_smoke(self, mock_post_json):
        mock_post_json.return_value = (
            {
                "ok": True,
                "videoDataUrl": VIDEO_DATA_URL,
                "thumbnailDataUrl": PNG_DATA_URL,
            },
            200,
        )

        with patch.dict(os.environ, {"AI_SUITE_VIDEO_URL": "https://example.com/video-provider"}):
            response = self.client.post(
                "/api/cap-anime/generate-video/",
                data={
                    "prompt": "anime duel in thunderstorm",
                    "duration": 6,
                    "aspect": "16:9",
                    "provider": "provider",
                },
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload.get("ok"))
        self.assertTrue(str(payload.get("videoUrl", "")).startswith("/api/cap-anime/media/videos/"))
        self.assertTrue(str(payload.get("thumbnailUrl", "")).startswith("/api/cap-anime/media/images/"))

        media_response = self.client.get(payload["videoUrl"])
        self.assertEqual(media_response.status_code, 200)

    def test_generate_video_provider_requires_config(self):
        with patch.dict(os.environ, {}, clear=False):
            response = self.client.post(
                "/api/cap-anime/generate-video/",
                data={
                    "prompt": "anime skyline",
                    "duration": 8,
                    "provider": "provider",
                },
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertFalse(payload.get("ok"))
