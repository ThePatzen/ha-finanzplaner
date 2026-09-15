"""Dependency-free reader for the Finanzplan Excel workbook format."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import io
import posixpath
import re
from zipfile import BadZipFile, ZipFile
import xml.etree.ElementTree as ET


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
_CELL_REF = re.compile(r"^(?P<column>[A-Z]+)\d+$")


class XlsxImportError(ValueError):
    """Raised when an XLSX file cannot be safely read."""


@dataclass(frozen=True, slots=True)
class Cell:
    """One worksheet cell with its cached value and optional formula."""

    value: str | Decimal | None
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
            if match:
                row[match.group("column")] = _cell_value(cell_node, shared)
        rows.append(row)
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
