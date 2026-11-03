#!/usr/bin/env python3
"""Check native color resources match exact pinned GC UI Foundations CSS roles."""
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = (ROOT / "web/foundations/gc-ui-tokens.v1.0.1.css").read_text(encoding="utf-8")
ROLE_MAP = {
  "gc_canvas": "canvas",
  "gc_surface": "surface",
  "gc_raised": "surface-raised",
  "gc_tonal": "surface-tonal",
  "gc_text": "on-surface",
  "gc_muted": "on-surface-muted",
  "gc_outline": "outline",
  "gc_primary": "primary",
  "gc_on_primary": "on-primary",
  "gc_secondary": "secondary",
  "gc_warning": "warning",
  "gc_tertiary": "tertiary"
}
# The accent deliberately follows GC UI Lagoon rather than its Iris default.
def variables(selector: str) -> dict[str, str]:
    start = CSS.find(selector + " {")
    if start < 0:
        raise AssertionError(f"GC UI selector missing: {selector}")
    section = CSS[start:CSS.index("}", start)]
    return {name: value.upper() for name, value in re.findall(
        r"--gc-v1-color-([\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;", section)}

for mode, directory in (("light", "values"), ("dark", "values-night")):
    base = variables(":root" if mode == "light" else ':root[data-gc-mode="dark"]')
    accent = variables(':root[data-gc-accent="lagoon"]' if mode == "light"
                       else ':root[data-gc-mode="dark"][data-gc-accent="lagoon"]')
    expected = {key: (accent.get(role) or base.get(role)) for key, role in ROLE_MAP.items()}
    if any(value is None for value in expected.values()):
        raise AssertionError(f"Missing GC UI semantic role in {mode} tokens: {expected}")
    path = ROOT / "android/app/src/main/res" / directory / "colors.xml"
    parsed = {element.attrib["name"]: (element.text or "").strip().upper()
              for element in ET.parse(path).getroot().findall("color")}
    if parsed != expected:
        raise AssertionError(f"{path} differs from pinned GC UI {mode} tokens: "
                             f"expected {expected}, got {parsed}")
print("Native Android light/dark GC UI v1.0.1 token parity PASS")
