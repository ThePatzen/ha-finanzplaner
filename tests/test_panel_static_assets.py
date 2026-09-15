"""Regression tests for release-scoped frontend assets."""

from urllib.parse import urljoin
import unittest

from custom_components.finanzplaner import const


class PanelStaticAssetsTest(unittest.TestCase):
    """Ensure browser module caches cannot retain a prior panel release."""

    def test_panel_and_relative_modules_use_the_same_release_namespace(self) -> None:
        build_path = getattr(
            const, "panel_static_path", lambda _version: "/api/finanzplaner/static"
        )("0.2.3")
        panel_url = f"https://ha.example{build_path}/panel.js"

        self.assertEqual(
            urljoin(panel_url, "panel-utils.mjs"),
            "https://ha.example/api/finanzplaner/static/0.2.3/panel-utils.mjs",
        )
