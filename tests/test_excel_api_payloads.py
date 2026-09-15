from decimal import Decimal
import unittest

from custom_components.finanzplaner.core import signed_plan_amount
from custom_components.finanzplaner.importers.excel_template import (
    ExcelImportPreview,
    ExcelWarning,
    PlanItemSuggestion,
    confirm_suggestions,
    preview_payload,
)


def build_preview() -> ExcelImportPreview:
    suggestion = PlanItemSuggestion(
        id="suggestion-1",
        direction="expense",
        name="Hundefutter",
        category="Hunde",
        area="Hunde",
        project=None,
        amount=Decimal("100.00"),
        frequency_months=1,
        normalized_monthly=Decimal("100.00"),
        annual_amount=Decimal("1200.00"),
        person_hint=None,
        source_sheet="Ausgaben",
        source_row=14,
        source_columns=("C", "K", "L"),
        source_formula=None,
        warnings=("derived_column",),
    )
    return ExcelImportPreview(
        preview_id="preview-1",
        suggestions=(suggestion,),
        warnings=(
            ExcelWarning(
                code="derived_column",
                message="Abgeleitete Spalte",
                sheet="Ausgaben",
                row=14,
            ),
        ),
        skipped_rows=3,
        historical_rows=2,
    )


class ExcelPayloadTests(unittest.TestCase):
    def test_preview_payload_contains_review_data_but_not_uploaded_bytes(self):
        payload = preview_payload(build_preview())

        self.assertEqual(payload["preview_id"], "preview-1")
        self.assertEqual(payload["suggestions"][0]["amount"], 100.0)
        self.assertEqual(payload["warnings"][0]["code"], "derived_column")
        self.assertEqual(payload["skipped_rows"], 3)
        self.assertEqual(payload["historical_rows"], 2)
        self.assertNotIn("raw", payload)
        self.assertNotIn("file_bytes", payload)

    def test_confirmation_applies_allowed_overrides_and_preserves_source(self):
        items, skipped = confirm_suggestions(
            build_preview(),
            ["suggestion-1"],
            {"suggestion-1": {"category": "Tierbedarf", "person_hint": "Alex"}},
        )

        self.assertEqual(skipped, 0)
        self.assertEqual(items[0]["category"], "Tierbedarf")
        self.assertEqual(items[0]["person_hint"], "Alex")
        self.assertEqual(items[0]["amount"], 100.0)
        self.assertEqual(items[0]["source_sheet"], "Ausgaben")
        self.assertEqual(items[0]["source_row"], 14)

    def test_confirmation_rejects_unknown_ids_and_override_fields(self):
        with self.assertRaises(ValueError):
            confirm_suggestions(build_preview(), ["unknown"], {})
        with self.assertRaises(ValueError):
            confirm_suggestions(
                build_preview(),
                ["suggestion-1"],
                {"suggestion-1": {"amount": 1}},
            )

    def test_imported_directions_keep_positive_storage_amounts(self):
        self.assertEqual(signed_plan_amount({"direction": "income", "amount": 100}), 100.0)
        self.assertEqual(signed_plan_amount({"direction": "expense", "amount": 100}), -100.0)
        self.assertEqual(signed_plan_amount({"direction": "saving", "amount": 100}), -100.0)


if __name__ == "__main__":
    unittest.main()
