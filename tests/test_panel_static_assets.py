"""Regression tests for release-scoped frontend assets."""

import json
import re
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
        self.assertEqual(version, "0.8.0")
        build_path = getattr(
            const, "panel_static_path", lambda _version: "/api/finanzplaner/static"
        )(version)
        panel_url = f"https://ha.example{build_path}/panel.js"

        self.assertEqual(
            urljoin(panel_url, "panel-utils.mjs"),
            "https://ha.example/api/finanzplaner/static/0.8.0/panel-utils.mjs",
        )

    def test_booking_lists_use_shared_detail_dialog_and_raw_data_action(self) -> None:
        panel_path = (
            Path(__file__).parents[1]
            / "custom_components"
            / "finanzplaner"
            / "frontend"
            / "panel.js"
        )
        source = panel_path.read_text(encoding="utf-8")

        self.assertIn("data-booking-detail-dialog", source)
        self.assertGreaterEqual(source.count("data-booking-details"), 2)
        self.assertIn("data-booking-raw-toggle", source)
        self.assertIn("bookingDetailsRequestUrl", source)
        self.assertIn("textContent = bookingDetailRawJson", source)

        resolved = re.search(
            r"  _resolvedBookingsTemplate\(\) \{(.*?)\n  _reviewTemplate\(\)",
            source,
            re.DOTALL,
        )
        review = re.search(
            r"  _reviewTemplate\(\) \{(.*?)\n}\n\ncustomElements.define",
            source,
            re.DOTALL,
        )
        self.assertIsNotNone(resolved)
        self.assertIsNotNone(review)
        details_button = re.compile(
            r'<button(?=[^>]*\btype="button")'
            r'(?=[^>]*\bdata-booking-details="\$\{escapeHtml\(bookingId\)\}")'
        )
        self.assertEqual(len(details_button.findall(resolved.group(1))), 1)
        self.assertEqual(len(details_button.findall(review.group(1))), 1)

    def test_booking_detail_empty_objects_use_missing_value_fallback(self) -> None:
        panel_path = (
            Path(__file__).parents[1]
            / "custom_components"
            / "finanzplaner"
            / "frontend"
            / "panel.js"
        )
        source = panel_path.read_text(encoding="utf-8")

        self.assertIn(
            'typeof value === "object" && Object.keys(value).length === 0',
            source,
        )

    def test_booking_detail_preserves_dialog_request_and_focus_across_refreshes(self) -> None:
        panel_path = (
            Path(__file__).parents[1]
            / "custom_components"
            / "finanzplaner"
            / "frontend"
            / "panel.js"
        )
        source = panel_path.read_text(encoding="utf-8")

        self.assertIn("const bookingDetailWasOpen =", source)
        self.assertIn("this._bookingDetailId", source)
        self.assertIn("const focusTarget =", source)
        self.assertIn(
            'content.querySelector("[data-booking-raw-toggle]")?.focus()',
            source,
        )

    def test_booking_detail_loading_and_legacy_states_have_visible_close_or_notice(self) -> None:
        panel_path = (
            Path(__file__).parents[1]
            / "custom_components"
            / "finanzplaner"
            / "frontend"
            / "panel.js"
        )
        source = panel_path.read_text(encoding="utf-8")

        loading = re.search(
            r"if \(this\._bookingDetailLoading\) return '(.*?)';",
            source,
            re.DOTALL,
        )
        self.assertIsNotNone(loading)
        self.assertIn("data-booking-detail-close", loading.group(1))
        self.assertIn("booking-detail-legacy", source)
        self.assertIn("alten Import", source)
