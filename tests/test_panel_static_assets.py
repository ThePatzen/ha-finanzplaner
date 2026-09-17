"""Regression tests for release-scoped frontend assets."""

import json
from pathlib import Path
from urllib.parse import urljoin
import unittest

from custom_components.finanzplaner import const


class PanelStaticAssetsTest(unittest.TestCase):
    """Ensure browser module caches cannot retain a prior panel release."""

    def test_panel_and_relative_modules_use_the_same_release_namespace(self) -> None:
        manifest_path = (
            Path(__file__).parents[1]
            / "custom_components"
            / "finanzplaner"
            / "manifest.json"
        )
        version = json.loads(manifest_path.read_text(encoding="utf-8"))["version"]
        self.assertEqual(version, "0.6.0")
        build_path = getattr(
            const, "panel_static_path", lambda _version: "/api/finanzplaner/static"
        )(version)
        panel_url = f"https://ha.example{build_path}/panel.js"

        self.assertEqual(
            urljoin(panel_url, "panel-utils.mjs"),
            "https://ha.example/api/finanzplaner/static/0.6.0/panel-utils.mjs",
        )
