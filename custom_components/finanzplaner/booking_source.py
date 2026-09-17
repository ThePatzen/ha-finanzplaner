from __future__ import annotations

from xml.etree.ElementTree import Element


def source_xml_node(
    element: Element,
    *,
    exclude_names: frozenset[str] = frozenset(),
) -> dict[str, object]:
    namespace, separator, name = element.tag.partition("}")
    if separator:
        namespace = namespace.removeprefix("{")
    else:
        namespace = ""
    return {
        "name": name if separator else element.tag,
        "namespace": namespace,
        "attributes": dict(element.attrib),
        "text": element.text or "",
        "tail": element.tail or "",
        "children": [
            source_xml_node(child, exclude_names=exclude_names)
            for child in element
            if child.tag.rsplit("}", 1)[-1] not in exclude_names
        ],
    }
