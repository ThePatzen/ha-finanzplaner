import io
from decimal import Decimal
from zipfile import ZIP_DEFLATED, ZipFile

import unittest

from custom_components.finanzplaner.importers.excel_template import (
    preview_template,
    read_xlsx,
)


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def build_fixture_xlsx() -> bytes:
    parts = {
        "xl/workbook.xml": f"""<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns="{MAIN_NS}" xmlns:r="{REL_NS}">
          <sheets><sheet name="Einnahmen" sheetId="1" r:id="rId1"/></sheets>
        </workbook>""",
        "xl/_rels/workbook.xml.rels": f"""<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="{PACKAGE_REL_NS}">
          <Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/>
        </Relationships>""",
        "xl/sharedStrings.xml": f"""<?xml version="1.0" encoding="UTF-8"?>
        <sst xmlns="{MAIN_NS}" count="7" uniqueCount="7">
          <si><t>Einkommen</t></si><si><t>Bezeichnung</t></si>
          <si><t>1 Monat</t></si><si><t>12 Monat</t></si>
          <si><t>Gehalt Alex</t></si><si><t>Wert heruntergebrochen pro Monat</t></si>
          <si><t>Pro Jahr</t></si>
        </sst>""",
        "xl/worksheets/sheet1.xml": f"""<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="{MAIN_NS}"><sheetData>
          <row r="1">
            <c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c>
            <c r="C1" t="s"><v>2</v></c><c r="G1" t="s"><v>3</v></c>
            <c r="K1" t="s"><v>5</v></c><c r="L1" t="s"><v>6</v></c>
          </row>
          <row r="2">
            <c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>4</v></c>
            <c r="C2"><v>3200</v></c><c r="K2"><f>C2+D2/2</f><v>3200</v></c>
          </row>
        </sheetData></worksheet>""",
    }
    result = io.BytesIO()
    with ZipFile(result, "w", ZIP_DEFLATED) as archive:
        for name, content in parts.items():
            archive.writestr(name, content)
    return result.getvalue()


def build_template_fixture_xlsx() -> bytes:
    sheet_names = [
        "Einnahmen",
        "Ausgaben",
        "Sparen  und Rücklagen",
        "Urlaubsgelder",
        "EMX Calc",
        "Übersicht",
    ]
    relationships = "".join(
        f'<Relationship Id="rId{index}" Type="worksheet" '
        f'Target="worksheets/sheet{index}.xml"/>'
        for index in range(1, len(sheet_names) + 1)
    )

    def inline_cell(reference: str, value: str) -> str:
        escaped = value.replace("&", "&amp;").replace("<", "&lt;")
        return f'<c r="{reference}" t="inlineStr"><is><t>{escaped}</t></is></c>'

    def numeric_cell(reference: str, value: str, formula: str | None = None) -> str:
        formula_xml = f"<f>{formula}</f>" if formula else ""
        return f'<c r="{reference}">{formula_xml}<v>{value}</v></c>'

    def sheet_xml(rows: list[str]) -> str:
        return (
            f'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="{MAIN_NS}">'
            f"<sheetData>{''.join(rows)}</sheetData></worksheet>"
        )

    main_header = (
        inline_cell("A1", "Kategorie")
        + inline_cell("B1", "Bezeichnung")
        + inline_cell("C1", "1 Monat")
        + inline_cell("G1", "12 Monat")
        + inline_cell("K1", "Wert heruntergebrochen pro Monat")
        + inline_cell("L1", "Pro Jahr")
    )
    income_rows = [
        f"<row r=\"1\">{main_header}</row>",
        f"<row r=\"2\">{inline_cell('A2', 'Einkommen')}{inline_cell('B2', 'Gehalt Alex')}"
        f"{numeric_cell('C2', '3200', '1600+1600')}{numeric_cell('K2', '3200', 'C2')}{numeric_cell('L2', '38400')}</row>",
        f"<row r=\"3\">{inline_cell('A3', 'Energie')}{inline_cell('B3', 'Solarerlös')}"
        f"{numeric_cell('G3', '1200')}{numeric_cell('K3', '100')}{numeric_cell('L3', '1200')}</row>",
        f"<row r=\"4\">{inline_cell('A4', 'Summe')}{numeric_cell('C4', '3200')}</row>",
    ]
    expense_rows = [
        f"<row r=\"1\">{main_header}</row>",
        f"<row r=\"2\">{inline_cell('A2', 'Hunde')}{inline_cell('B2', 'Hundefutter')}"
        f"{numeric_cell('C2', '100')}{numeric_cell('K2', '100')}{numeric_cell('L2', '1200')}</row>",
        f"<row r=\"3\">{inline_cell('A3', 'Sonstiges')}{inline_cell('B3', 'Summe')}{numeric_cell('C3', '100')}</row>",
    ]
    savings_header = (
        inline_cell("A1", "Kategorie")
        + inline_cell("B1", "Bezeichnung")
        + inline_cell("C1", "1 Monat")
        + inline_cell("I1", "Wert heruntergebrochen pro Monat")
        + inline_cell("J1", "pro Jahr")
    )
    savings_rows = [
        f"<row r=\"1\">{savings_header}</row>",
        f"<row r=\"2\">{inline_cell('A2', 'Sparen')}{inline_cell('B2', 'Rücklagen')}"
        f"{numeric_cell('C2', '200')}{numeric_cell('I2', '200')}{numeric_cell('J2', '2400')}</row>",
    ]
    holiday_rows = [
        f"<row r=\"1\">{inline_cell('B1', 'Alex')}{inline_cell('C1', 'Sam')}"
        f"{inline_cell('E1', 'Alex 2024')}{inline_cell('F1', 'Sam 2024')}</row>",
        f"<row r=\"2\">{inline_cell('A2', 'Urlaubsgeld Sommer')}{numeric_cell('B2', '1000')}"
        f"{numeric_cell('C2', '900')}{numeric_cell('E2', '950')}{numeric_cell('F2', '850')}</row>",
        f"<row r=\"3\">{inline_cell('A3', 'Urlaubsgeld Winter')}{numeric_cell('B3', '1000')}"
        f"{numeric_cell('C3', '900')}{numeric_cell('E3', '950')}{numeric_cell('F3', '850')}</row>",
        f"<row r=\"4\">{inline_cell('A4', 'Summe Urlaubsgeld')}{numeric_cell('B4', '2000')}</row>",
    ]
    emx_rows = [
        f"<row r=\"1\">{inline_cell('A1', 'EMX')}</row>",
        f"<row r=\"2\">{inline_cell('B2', 'Domain')}{numeric_cell('C2', '10')}"
        f"{numeric_cell('D2', '120')}{inline_cell('I2', 'Domain')}{numeric_cell('J2', '11')}"
        f"{numeric_cell('K2', '132')}</row>",
        f"<row r=\"3\">{inline_cell('B3', 'Summe')}{numeric_cell('C3', '10')}</row>",
    ]
    empty_rows = [f"<row r=\"1\">{inline_cell('A1', 'Bericht')}</row>"]
    sheet_rows = [income_rows, expense_rows, savings_rows, holiday_rows, emx_rows, empty_rows]
    parts = {
        "xl/workbook.xml": f'''<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns="{MAIN_NS}" xmlns:r="{REL_NS}"><sheets>
        {''.join(f'<sheet name="{name}" sheetId="{index}" r:id="rId{index}"/>' for index, name in enumerate(sheet_names, 1))}
        </sheets></workbook>''',
        "xl/_rels/workbook.xml.rels": f'''<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="{PACKAGE_REL_NS}">{relationships}</Relationships>''',
    }
    parts.update(
        {
            f"xl/worksheets/sheet{index}.xml": sheet_xml(rows)
            for index, rows in enumerate(sheet_rows, 1)
        }
    )
    result = io.BytesIO()
    with ZipFile(result, "w", ZIP_DEFLATED) as archive:
        for name, content in parts.items():
            archive.writestr(name, content)
    return result.getvalue()


class XlsxReaderTests(unittest.TestCase):
    def test_reads_shared_strings_cached_values_and_formulas(self):
        from custom_components.finanzplaner.importers.excel_template import read_xlsx

        workbook = read_xlsx(build_fixture_xlsx())
        row = workbook.sheets["Einnahmen"].rows[1]

        self.assertEqual(row["A"].value, "Einkommen")
        self.assertEqual(row["B"].value, "Gehalt Alex")
        self.assertEqual(row["C"].value, Decimal("3200.00"))
        self.assertEqual(row["K"].value, Decimal("3200.00"))
        self.assertEqual(row["K"].formula, "C2+D2/2")


class TemplateNormalizationTests(unittest.TestCase):
    def test_normalizes_main_sheets_and_hunde_area(self):
        preview = preview_template(build_template_fixture_xlsx(), "preview-1")
        names = {
            (item.source_sheet, item.name, item.frequency_months)
            for item in preview.suggestions
        }

        self.assertIn(("Einnahmen", "Gehalt Alex", 1), names)
        self.assertIn(("Ausgaben", "Hundefutter", 1), names)
        self.assertIn(("Sparen  und Rücklagen", "Rücklagen", 1), names)
        hunde = next(item for item in preview.suggestions if item.name == "Hundefutter")
        self.assertEqual(hunde.area, "Hunde")
        self.assertEqual(hunde.direction, "expense")
        salary = next(item for item in preview.suggestions if item.name == "Gehalt Alex")
        self.assertEqual(salary.category, "Gehalt")
        self.assertEqual(salary.person_hint, "Alex")

    def test_formula_and_historical_values_are_warnings(self):
        preview = preview_template(build_template_fixture_xlsx(), "preview-2")
        codes = {warning.code for warning in preview.warnings}

        self.assertIn("formula_value", codes)
        self.assertIn("historical_value", codes)
        self.assertIn("comparison_table_diff", codes)
        self.assertEqual(sum(item.name == "Summe" for item in preview.suggestions), 0)


if __name__ == "__main__":
    unittest.main()
