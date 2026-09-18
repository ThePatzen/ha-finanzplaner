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
        self.assertEqual(version, "0.13.1")
        build_path = getattr(
            const, "panel_static_path", lambda _version: "/api/finanzplaner/static"
        )(version)
        panel_url = f"https://ha.example{build_path}/panel.js"

        self.assertEqual(
            urljoin(panel_url, "panel-utils.mjs"),
            f"https://ha.example/api/finanzplaner/static/{version}/panel-utils.mjs",
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

    def test_booking_lists_expose_shared_filters_and_pagination_controls(self) -> None:
        panel_path = (
            Path(__file__).parents[1]
            / "custom_components"
            / "finanzplaner"
            / "frontend"
            / "panel.js"
        )
        source = panel_path.read_text(encoding="utf-8")

        self.assertGreaterEqual(source.count("data-booking-history-filter"), 2)
        self.assertIn("data-booking-page-size", source)
        self.assertIn('value="0"', source)
        self.assertIn(">Alle</option>", source)

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

    def test_resolved_rows_offer_edit_action_and_missing_target_marker(self) -> None:
        source = (Path(__file__).parents[1] / "custom_components" / "finanzplaner" / "frontend" / "panel.js").read_text(encoding="utf-8")
        self.assertIn("data-edit-resolved-booking", source)
        self.assertIn("Person fehlt", source)

    def test_resolved_allocation_editor_manages_focus_on_open_and_cancel(self) -> None:
        source = (Path(__file__).parents[1] / "custom_components" / "finanzplaner" / "frontend" / "panel.js").read_text(encoding="utf-8")
        self.assertIn("this._resolvedEditTriggers", source)
        self.assertIn("[data-allocation-field=\"target\"]", source)
        self.assertIn("this._resolvedEditTriggers.get(bookingId)", source)

    def test_report_switcher_loads_report_endpoint_and_renders_states(self) -> None:
        source = (Path(__file__).parents[1] / "custom_components" / "finanzplaner" / "frontend" / "panel.js").read_text(encoding="utf-8")
        self.assertIn('const REPORT_URL = "/api/finanzplaner/report"', source)
        self.assertIn("reportRequestUrl(REPORT_URL", source)
        self.assertIn("_reportLoading", source)
        self.assertIn("_reportLoadFailed", source)
        self.assertIn("Cashflow", source)
        self.assertIn("<table", source)

    def test_filter_result_count_is_visible(self) -> None:
        source = (Path(__file__).parents[1] / "custom_components" / "finanzplaner" / "frontend" / "panel.js").read_text(encoding="utf-8")
        self.assertIn("Buchungen gefunden", source)

    def test_missing_target_repair_uses_repair_endpoint_and_payload_helper(self) -> None:
        source = (Path(__file__).parents[1] / "custom_components" / "finanzplaner" / "frontend" / "panel.js").read_text(encoding="utf-8")
        self.assertIn("repairTargetsPayload", source)
        self.assertIn("/repair-targets", source)
        self.assertIn("data-repair-target", source)

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

    def test_booking_surfaces_distinguish_sender_and_counterparty(self) -> None:
        panel_path = (
            Path(__file__).parents[1]
            / "custom_components"
            / "finanzplaner"
            / "frontend"
            / "panel.js"
        )
        source = panel_path.read_text(encoding="utf-8")

        self.assertIn('sender: "Absender"', source)
        self.assertIn('counterparty: "Zahlungsempfänger"', source)
        self.assertIn('sender || "Nicht vorhanden"', source)
        self.assertGreaterEqual(source.count("Absender:"), 2)
        self.assertGreaterEqual(source.count("booking.sender"), 2)

    def test_booking_surfaces_show_configured_internal_account_labels_inline(self) -> None:
        panel_path = (
            Path(__file__).parents[1]
            / "custom_components"
            / "finanzplaner"
            / "frontend"
            / "panel.js"
        )
        source = panel_path.read_text(encoding="utf-8")

        self.assertIn("booking_accounts", source)
        self.assertIn("_bookingAccountInlineTemplate", source)
        self.assertIn('className = "booking-account-inline"', source)
        self.assertIn("booking?.booking_accounts", source)
        self.assertIn("booking.booking_accounts", source)

    def test_booking_selection_toolbar_offers_original_upload_export(self) -> None:
        panel_path = (
            Path(__file__).parents[1]
            / "custom_components"
            / "finanzplaner"
            / "frontend"
            / "panel.js"
        )
        source = panel_path.read_text(encoding="utf-8")

        self.assertIn("data-export-bookings", source)
        self.assertIn("Originaldaten exportieren", source)
        self.assertIn("BOOKING_EXPORT_URL", source)
