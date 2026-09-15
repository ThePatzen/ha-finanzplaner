"""Dependency-free reader for the Finanzplan Excel workbook format."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import hashlib
import io
import posixpath
import re
from zipfile import BadZipFile, ZipFile
import xml.etree.ElementTree as ET


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
_CELL_REF = re.compile(r"^(?P<column>[A-Z]+)\d+$")
_MONEY_QUANT = Decimal("0.01")
_RHYTHMS = (("C", 1), ("D", 2), ("E", 3), ("F", 6), ("G", 12))
_REQUIRED_SHEETS = ("Einnahmen", "Ausgaben", "Sparen  und Rücklagen")
_OPTIONAL_SHEETS = ("Urlaubsgelder", "EMX Calc", "Übersicht")


class XlsxImportError(ValueError):
    """Raised when an XLSX file cannot be safely read."""


@dataclass(frozen=True, slots=True)
class Cell:
    """One worksheet cell with its cached value and optional formula."""

    value: str | Decimal | bool | None
    formula: str | None = None


@dataclass(frozen=True, slots=True)
class Sheet:
    """A worksheet represented as rows keyed by Excel column letters."""

    name: str
    rows: tuple[dict[str, Cell], ...]


@dataclass(frozen=True, slots=True)
class Workbook:
    """The subset of an XLSX workbook needed by the migration."""

    sheets: dict[str, Sheet]


@dataclass(frozen=True, slots=True)
class ExcelWarning:
    """One review warning produced while normalizing the workbook."""

    code: str
    message: str
    sheet: str
    row: int | None


@dataclass(frozen=True, slots=True)
class PlanItemSuggestion:
    """A reviewable plan item derived from one source row and rhythm cell."""

    id: str
    direction: str
    name: str
    category: str
    area: str | None
    project: str | None
    amount: Decimal
    frequency_months: int | None
    normalized_monthly: Decimal | None
    annual_amount: Decimal | None
    person_hint: str | None
    source_sheet: str
    source_row: int
    source_columns: tuple[str, ...]
    source_formula: str | None
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class ExcelImportPreview:
    """Transient, non-persistent result of an Excel template analysis."""

    preview_id: str
    suggestions: tuple[PlanItemSuggestion, ...]
    warnings: tuple[ExcelWarning, ...]
    skipped_rows: int
    historical_rows: int


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _find_text(element: ET.Element, name: str) -> str:
    for child in element.iter():
        if _local_name(child.tag) == name and child.text:
            return child.text
    return ""


def _shared_strings(archive: ZipFile) -> list[str]:
    try:
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return ["".join(si.itertext()).strip() for si in root if _local_name(si.tag) == "si"]


def _cell_value(cell: ET.Element, shared: list[str]) -> Cell:
    cell_type = cell.attrib.get("t")
    formula_node = next((node for node in cell if _local_name(node.tag) == "f"), None)
    value_node = next((node for node in cell if _local_name(node.tag) == "v"), None)
    formula = formula_node.text.strip() if formula_node is not None and formula_node.text else None
    raw_value = value_node.text.strip() if value_node is not None and value_node.text else ""

    if cell_type == "inlineStr":
        value: str | Decimal | None = _find_text(cell, "t").strip() or None
    elif cell_type == "s":
        try:
            value = shared[int(raw_value)]
        except (IndexError, ValueError) as exc:
            raise XlsxImportError("Die XLSX-Arbeitsmappe konnte nicht gelesen werden.") from exc
    elif cell_type in {"str", "e"}:
        value = raw_value or None
    elif cell_type == "b":
        value = raw_value == "1"
    elif raw_value:
        try:
            value = Decimal(raw_value)
        except InvalidOperation:
            value = raw_value
    else:
        value = None
    return Cell(value=value, formula=formula)


def _sheet_from_xml(name: str, raw: bytes, shared: list[str]) -> Sheet:
    root = ET.fromstring(raw)
    rows: list[dict[str, Cell]] = []
    for row_node in root.iter():
        if _local_name(row_node.tag) != "row":
            continue
        row: dict[str, Cell] = {}
        for cell_node in row_node:
            if _local_name(cell_node.tag) != "c":
                continue
            match = _CELL_REF.match(cell_node.attrib.get("r", ""))
            if not match:
                continue
            parsed = _cell_value(cell_node, shared)
            if parsed.value is not None or parsed.formula is not None:
                row[match.group("column")] = parsed
        try:
            row_number = int(row_node.attrib.get("r", len(rows) + 1))
        except ValueError:
            row_number = len(rows) + 1
        while len(rows) < row_number:
            rows.append({})
        rows[row_number - 1] = row
    return Sheet(name=name, rows=tuple(rows))


def read_xlsx(raw: bytes) -> Workbook:
    """Read workbook sheets, cached cell values, and formulas from XLSX bytes."""

    try:
        archive = ZipFile(io.BytesIO(raw))
    except (BadZipFile, OSError, TypeError) as exc:
        raise XlsxImportError("Die Datei ist kein gültiges XLSX-Archiv.") from exc

    try:
        with archive:
            workbook_root = ET.fromstring(archive.read("xl/workbook.xml"))
            relationships_root = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
            relationships = {
                relation.attrib["Id"]: relation.attrib["Target"]
                for relation in relationships_root
                if relation.attrib.get("Id") and relation.attrib.get("Target")
            }
            shared = _shared_strings(archive)
            sheets: dict[str, Sheet] = {}
            sheet_nodes = [node for node in workbook_root.iter() if _local_name(node.tag) == "sheet"]
            for sheet_node in sheet_nodes:
                name = sheet_node.attrib.get("name", "").strip()
                relation_id = sheet_node.attrib.get(f"{{{REL_NS}}}id")
                target = relationships.get(relation_id or "")
                if not name or not target:
                    raise XlsxImportError("Die XLSX-Arbeitsmappe konnte nicht gelesen werden.")
                worksheet_path = posixpath.normpath(posixpath.join("xl", target.lstrip("/")))
                sheets[name] = _sheet_from_xml(name, archive.read(worksheet_path), shared)
    except XlsxImportError:
        raise
    except (ET.ParseError, KeyError, UnicodeError, ValueError) as exc:
        raise XlsxImportError("Die XLSX-Arbeitsmappe konnte nicht gelesen werden.") from exc

    if not sheets:
        raise XlsxImportError("Die XLSX-Arbeitsmappe enthält keine Arbeitsblätter.")
    return Workbook(sheets=sheets)


def _money(value: Decimal) -> Decimal:
    return value.quantize(_MONEY_QUANT)


def _cell(sheet: Sheet, row: int, column: str) -> Cell | None:
    if row < 1 or row > len(sheet.rows):
        return None
    return sheet.rows[row - 1].get(column)


def _text(cell: Cell | None) -> str:
    if cell is None or cell.value is None:
        return ""
    return str(cell.value).strip()


def _decimal(cell: Cell | None) -> Decimal | None:
    if cell is None or cell.value is None or isinstance(cell.value, bool):
        return None
    if isinstance(cell.value, Decimal):
        return cell.value
    normalized = str(cell.value).strip().replace(" ", "")
    if not normalized:
        return None
    if "," in normalized:
        normalized = normalized.replace(".", "").replace(",", ".")
    try:
        return Decimal(normalized)
    except InvalidOperation:
        return None


def _has_value(cell: Cell | None) -> bool:
    return cell is not None and (cell.value is not None or cell.formula is not None)


def _nonzero(cell: Cell | None) -> Decimal | None:
    value = _decimal(cell)
    if value is None or value == 0:
        return None
    return _money(abs(value))


def _warning_message(code: str) -> str:
    return {
        "formula_value": "Der Betrag stammt aus einer Excel-Formel und muss geprüft werden.",
        "derived_column": "Der Wert stammt aus einer abgeleiteten Excel-Spalte.",
        "historical_value": "Der Wert stammt aus dem historischen Vergleich und wird nicht importiert.",
        "empty_calculation_row": "Die Zeile enthält nur eine Berechnung und wird übersprungen.",
        "unmapped_category": "Für die Excel-Kategorie ist noch keine Finanzplaner-Zuordnung bekannt.",
        "comparison_table_diff": "Die Vergleichstabelle in EMX Calc weicht von der Haupttabelle ab.",
        "missing_sheet": "Das optionale Excel-Blatt ist nicht vorhanden.",
    }.get(code, "Der Import benötigt eine manuelle Prüfung.")


def _formula(cells: list[Cell | None]) -> str | None:
    formulas = [cell.formula for cell in cells if cell is not None and cell.formula]
    return "; ".join(formulas) if formulas else None


def _suggestion_id(
    *, sheet: str, row: int, rhythm: str, direction: str, name: str, amount: Decimal
) -> str:
    material = "|".join(
        (sheet, str(row), rhythm, direction, name.strip(), f"{amount:.2f}")
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def _mapped_fields(category: str, name: str, direction: str, sheet: str) -> tuple[str, str | None, str | None, str | None, list[str]]:
    category_value = category.strip()
    name_value = name.strip()
    folded = name_value.casefold()
    area = "Hunde" if any(term in folded for term in ("hundefutter", "hundesteuer")) else None
    project = "EMX" if sheet == "EMX Calc" or "emx" in folded else None
    person_hint = None
    if re.search(r"\bgehalt\b", folded):
        category_value = "Gehalt"
        match = re.search(r"\bgehalt\b\s*[-:]?\s*(.+)$", name_value, re.IGNORECASE)
        person_hint = match.group(1).strip() if match else None
    if direction == "income" and any(term in folded for term in ("pv", "photovoltaik", "solar")):
        category_value = "PV-Erlöse"
        project = "PV-Anlage"
    warnings = ["unmapped_category"] if not category_value else []
    return category_value, area, project, person_hint, warnings


def _append_warning(
    warnings: list[ExcelWarning], code: str, sheet: str, row: int | None
) -> None:
    warnings.append(ExcelWarning(code, _warning_message(code), sheet, row))


def _main_sheet_suggestions(
    sheet: Sheet,
    direction: str,
    suggestions: list[PlanItemSuggestion],
    warnings: list[ExcelWarning],
) -> int:
    skipped = 0
    derived_columns = ("I", "J") if sheet.name == "Sparen  und Rücklagen" else ("K", "L")
    for row_number, row in enumerate(sheet.rows, 1):
        category = _text(row.get("A"))
        name = _text(row.get("B"))
        if row_number == 1 and category.casefold() == "kategorie":
            continue
        if name.casefold() == "summe":
            skipped += 1
            continue

        rhythm_values = [
            (column, frequency, _nonzero(row.get(column)))
            for column, frequency in _RHYTHMS
        ]
        if not name or not any(value is not None for _, _, value in rhythm_values):
            derived_present = any(_has_value(row.get(column)) for column in derived_columns)
            if not name and derived_present:
                _append_warning(warnings, "empty_calculation_row", sheet.name, row_number)
            skipped += 1
            continue

        mapped_category, area, project, person_hint, row_warnings = _mapped_fields(
            category, name, direction, sheet.name
        )
        for code in row_warnings:
            _append_warning(warnings, code, sheet.name, row_number)
        for rhythm_column, frequency, amount in rhythm_values:
            if amount is None:
                continue
            monthly_cell = row.get(derived_columns[0])
            annual_cell = row.get(derived_columns[1])
            monthly = _decimal(monthly_cell)
            annual = _decimal(annual_cell)
            if monthly is None:
                monthly = amount / frequency
            if annual is None:
                annual = amount * 12 / frequency
            item_warnings = list(row_warnings)
            relevant_cells = [row.get(rhythm_column), monthly_cell, annual_cell]
            if any(cell is not None and cell.formula for cell in relevant_cells):
                item_warnings.append("formula_value")
                _append_warning(warnings, "formula_value", sheet.name, row_number)
            if any(_has_value(row.get(column)) for column in derived_columns):
                item_warnings.append("derived_column")
                _append_warning(warnings, "derived_column", sheet.name, row_number)
            source_columns = [rhythm_column]
            source_columns.extend(
                column for column in derived_columns if _has_value(row.get(column))
            )
            suggestions.append(
                PlanItemSuggestion(
                    id=_suggestion_id(
                        sheet=sheet.name,
                        row=row_number,
                        rhythm=rhythm_column,
                        direction=direction,
                        name=name,
                        amount=amount,
                    ),
                    direction=direction,
                    name=name,
                    category=mapped_category,
                    area=area,
                    project=project,
                    amount=amount,
                    frequency_months=frequency,
                    normalized_monthly=_money(monthly),
                    annual_amount=_money(annual),
                    person_hint=person_hint,
                    source_sheet=sheet.name,
                    source_row=row_number,
                    source_columns=tuple(source_columns),
                    source_formula=_formula(relevant_cells),
                    warnings=tuple(dict.fromkeys(item_warnings)),
                )
            )
    return skipped


def _holiday_suggestions(
    sheet: Sheet,
    suggestions: list[PlanItemSuggestion],
    warnings: list[ExcelWarning],
) -> tuple[int, int]:
    skipped = 0
    historical_rows = 0
    for row_number, row in enumerate(sheet.rows, 1):
        name = _text(row.get("A"))
        if row_number == 1 or not name:
            continue
        if name.casefold().startswith("summe"):
            skipped += 1
            continue
        historical_present = any(_nonzero(row.get(column)) is not None for column in ("E", "F"))
        if historical_present:
            historical_rows += 1
            _append_warning(warnings, "historical_value", sheet.name, row_number)
        for column in ("B", "C"):
            amount = _nonzero(row.get(column))
            if amount is None:
                continue
            person_hint = _text(_cell(sheet, 1, column)) or None
            item_warnings: list[str] = []
            current_cell = row.get(column)
            if current_cell is not None and current_cell.formula:
                item_warnings.append("formula_value")
                _append_warning(warnings, "formula_value", sheet.name, row_number)
            suggestions.append(
                PlanItemSuggestion(
                    id=_suggestion_id(
                        sheet=sheet.name,
                        row=row_number,
                        rhythm=column,
                        direction="income",
                        name=name,
                        amount=amount,
                    ),
                    direction="income",
                    name=name,
                    category="Urlaubsgeld",
                    area="Urlaub",
                    project=None,
                    amount=amount,
                    frequency_months=12,
                    normalized_monthly=_money(amount / 12),
                    annual_amount=amount,
                    person_hint=person_hint,
                    source_sheet=sheet.name,
                    source_row=row_number,
                    source_columns=(column,),
                    source_formula=_formula([current_cell]),
                    warnings=tuple(item_warnings),
                )
            )
    return skipped, historical_rows


def _emx_suggestions(
    sheet: Sheet,
    suggestions: list[PlanItemSuggestion],
    warnings: list[ExcelWarning],
) -> int:
    skipped = 0
    comparison: dict[str, tuple[Decimal | None, Decimal | None, int]] = {}
    for row_number, row in enumerate(sheet.rows, 1):
        name = _text(row.get("I"))
        if name and not name.casefold().startswith("summe"):
            comparison[name.casefold()] = (_decimal(row.get("J")), _decimal(row.get("K")), row_number)
    for row_number, row in enumerate(sheet.rows, 1):
        name = _text(row.get("B"))
        if not name:
            continue
        if name.casefold().startswith("summe"):
            skipped += 1
            continue
        monthly_value = _decimal(row.get("C"))
        annual_value = _decimal(row.get("D"))
        if (monthly_value is None or monthly_value == 0) and (annual_value is None or annual_value == 0):
            skipped += 1
            continue
        monthly = _money(monthly_value if monthly_value not in (None, 0) else annual_value / 12)
        annual = _money(annual_value if annual_value not in (None, 0) else monthly * 12)
        right = comparison.get(name.casefold())
        if right and (
            right[0] is not None and abs(_money(right[0]) - monthly) > _MONEY_QUANT
            or right[1] is not None and abs(_money(right[1]) - annual) > _MONEY_QUANT
        ):
            _append_warning(warnings, "comparison_table_diff", sheet.name, row_number)
        item_warnings: list[str] = []
        if any(row.get(column) is not None and row.get(column).formula for column in ("C", "D")):
            item_warnings.append("formula_value")
            _append_warning(warnings, "formula_value", sheet.name, row_number)
        suggestions.append(
            PlanItemSuggestion(
                id=_suggestion_id(
                    sheet=sheet.name,
                    row=row_number,
                    rhythm="C",
                    direction="expense",
                    name=name,
                    amount=monthly,
                ),
                direction="expense",
                name=name,
                category="EMX",
                area=None,
                project="EMX",
                amount=monthly,
                frequency_months=1,
                normalized_monthly=monthly,
                annual_amount=annual,
                person_hint=None,
                source_sheet=sheet.name,
                source_row=row_number,
                source_columns=tuple(column for column in ("B", "C", "D") if _has_value(row.get(column))),
                source_formula=_formula([row.get("C"), row.get("D")]),
                warnings=tuple(item_warnings),
            )
        )
    return skipped


def preview_template(raw: bytes, preview_id: str) -> ExcelImportPreview:
    """Read and normalize the supported finance-plan workbook sheets."""

    workbook = read_xlsx(raw)
    missing = [name for name in _REQUIRED_SHEETS if name not in workbook.sheets]
    if missing:
        names = ", ".join(missing)
        raise XlsxImportError(f"Die XLSX-Arbeitsmappe enthält Pflichtblätter nicht: {names}.")

    suggestions: list[PlanItemSuggestion] = []
    warnings: list[ExcelWarning] = []
    skipped_rows = 0
    historical_rows = 0
    for name, direction in (
        ("Einnahmen", "income"),
        ("Ausgaben", "expense"),
        ("Sparen  und Rücklagen", "saving"),
    ):
        skipped_rows += _main_sheet_suggestions(
            workbook.sheets[name], direction, suggestions, warnings
        )
    if "Urlaubsgelder" in workbook.sheets:
        skipped, historical = _holiday_suggestions(
            workbook.sheets["Urlaubsgelder"], suggestions, warnings
        )
        skipped_rows += skipped
        historical_rows += historical
    if "EMX Calc" in workbook.sheets:
        skipped_rows += _emx_suggestions(workbook.sheets["EMX Calc"], suggestions, warnings)
    for name in _OPTIONAL_SHEETS:
        if name not in workbook.sheets:
            _append_warning(warnings, "missing_sheet", name, None)
    return ExcelImportPreview(
        preview_id=preview_id,
        suggestions=tuple(suggestions),
        warnings=tuple(warnings),
        skipped_rows=skipped_rows,
        historical_rows=historical_rows,
    )
