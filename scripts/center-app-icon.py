"""Center logo on square black canvas and write master PNG for Tauri icon generation."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

CANVAS = 1024
MARGIN_RATIO = 0.14  # even black border on all sides

# App accent gradient: #ff6b35 → light peach
ORANGE_DARK = (255, 107, 53)
ORANGE_LIGHT = (255, 210, 170)


def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    px = img.load()
    w, h = img.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 20 and max(r, g, b) > 25:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x < min_x:
        raise ValueError("No visible logo pixels found in source image.")
    return min_x, min_y, max_x, max_y


def recolor_to_orange(img: Image.Image) -> Image.Image:
    """Map the purple logo gradient to an orange accent gradient."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20 or max(r, g, b) < 25:
                continue
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
            t = max(0.0, min(1.0, lum**0.85))
            nr = int(ORANGE_DARK[0] + (ORANGE_LIGHT[0] - ORANGE_DARK[0]) * t)
            ng = int(ORANGE_DARK[1] + (ORANGE_LIGHT[1] - ORANGE_DARK[1]) * t)
            nb = int(ORANGE_DARK[2] + (ORANGE_LIGHT[2] - ORANGE_DARK[2]) * t)
            px[x, y] = (nr, ng, nb, a)
    return out


def center_on_square(source: Path, dest: Path, *, orange: bool = False) -> None:
    img = Image.open(source).convert("RGBA")
    min_x, min_y, max_x, max_y = content_bbox(img)
    logo = img.crop((min_x, min_y, max_x + 1, max_y + 1))
    if orange:
        logo = recolor_to_orange(logo)

    usable = int(CANVAS * (1 - 2 * MARGIN_RATIO))
    scale = min(usable / logo.width, usable / logo.height)
    new_size = (max(1, int(logo.width * scale)), max(1, int(logo.height * scale)))
    logo = logo.resize(new_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 255))
    paste_x = (CANVAS - logo.width) // 2
    paste_y = (CANVAS - logo.height) // 2
    canvas.paste(logo, (paste_x, paste_y), logo)
    canvas.save(dest, format="PNG")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--orange"]
    orange = "--orange" in sys.argv
    src = Path(args[0]) if args else None
    if src is None:
        print(
            "Usage: center-app-icon.py [--orange] <source.png> [dest.png]",
            file=sys.stderr,
        )
        sys.exit(1)
    dest = Path(args[1]) if len(args) > 1 else Path("app-icon.png")
    center_on_square(src, dest, orange=orange)
    print(f"Wrote {dest} ({CANVAS}x{CANVAS})")
