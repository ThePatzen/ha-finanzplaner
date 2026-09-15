import io
from decimal import Decimal
from zipfile import ZIP_DEFLATED, ZipFile

import unittest

from custom_components.finanzplaner.importers.excel_template import read_xlsx


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


if __name__ == "__main__":
    unittest.main()
