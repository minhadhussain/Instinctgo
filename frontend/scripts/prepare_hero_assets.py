"""Prepare the supplied hero screenshots as compositing layers.

Run from the repository root: python frontend/scripts/prepare_hero_assets.py
Requires Pillow, NumPy, and OpenCV in the Python environment used for asset preparation.
Crop/mask coordinates refer to the current 862x508 foreground screenshot.
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "public" / "images" / "hero"


def prepare_foreground() -> None:
    original = Image.open(ASSETS / "foreground.png").convert("RGB")
    if original.size != (862, 508):
        raise ValueError("The foreground crop must be updated for the new source dimensions.")

    pixels = np.array(original)
    logo_mask = np.zeros(pixels.shape[:2], dtype=np.uint8)
    cv2.circle(logo_mask, (740, 396), 20, 255, -1)
    repaired = cv2.inpaint(pixels, logo_mask, 5, cv2.INPAINT_TELEA)

    # Exclude the screenshot's outer frame, rounded corners, and bottom controls.
    cropped = repaired[64:421, 16:809].copy()
    foreground = (cropped.min(axis=2) < 235).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(foreground, connectivity=8)
    if count < 2:
        raise ValueError("No foreground subject found in the source image.")
    largest = 1 + stats[1:, cv2.CC_STAT_AREA].argmax()
    solid = (labels == largest).astype(np.uint8)

    # Unmatte the white antialiasing around the silhouettes to prevent pale halos.
    boundary = solid - cv2.erode(solid, np.ones((3, 3), dtype=np.uint8))
    alpha = solid.astype(np.float32)
    edge_alpha = np.clip((255 - cropped.min(axis=2).astype(np.float32)) / 230, 0, 1)
    alpha[boundary > 0] = edge_alpha[boundary > 0]
    rgb = cropped.astype(np.float32)
    edge = (alpha > 0) & (alpha < 1)
    rgb[edge] = np.clip(
        (rgb[edge] - 255 * (1 - alpha[edge, None])) / alpha[edge, None], 0, 255
    )
    rgba = np.dstack((rgb.astype(np.uint8), (alpha * 255).astype(np.uint8)))
    Image.fromarray(rgba).save(ASSETS / "foreground-clean.webp", lossless=True)


def prepare_background() -> None:
    original = Image.open(ASSETS / "background.png").convert("RGB")
    # Trim the narrow screenshot edge so the building fills the hero cleanly.
    original.crop((3, 2, original.width, original.height)).save(
        ASSETS / "background-hero.webp", quality=92, method=6
    )


if __name__ == "__main__":
    prepare_foreground()
    prepare_background()
    print("Created foreground-clean.webp and background-hero.webp")
