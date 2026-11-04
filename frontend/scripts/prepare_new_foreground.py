"""Prepare the 1024x410 silhouette JPEG as a clean, transparent 4K foreground.

Run: python frontend/scripts/prepare_new_foreground.py
Requires Pillow, NumPy, and OpenCV. No model weights are needed for a silhouette.
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "public" / "images" / "hero"
SCALE = 4


def main() -> None:
    source = Image.open(ASSETS / "newforeground.jpeg").convert("L")
    if source.size != (1024, 410):
        raise ValueError("Update the logo coordinates for the new source dimensions.")
    luminance = np.array(source)

    # The Gemini mark sits entirely inside the solid ground. Restore that region
    # before extracting transparency, so it cannot become a hole in the matte.
    cv2.circle(luminance, (949, 334), 27, 0, -1)
    luminance = cv2.GaussianBlur(luminance, (3, 3), 0.45)

    candidate = (luminance < 128).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, connectivity=8)
    if count < 2:
        raise ValueError("No connected silhouette and ground found.")
    core = (labels == 1 + stats[1:, cv2.CC_STAT_AREA].argmax()).astype(np.uint8)

    # Recover the antialiased contour from its white matte. Fully opaque interiors
    # remove JPEG speckles; the support mask rejects background compression noise.
    kernel = np.ones((3, 3), dtype=np.uint8)
    alpha = np.clip((252 - luminance.astype(np.float32)) / 248, 0, 1)
    alpha[cv2.erode(core, kernel) > 0] = 1
    alpha[cv2.dilate(core, kernel) == 0] = 0

    size = (source.width * SCALE, source.height * SCALE)
    matte = cv2.resize(alpha, size, interpolation=cv2.INTER_CUBIC)
    # Tighten JPEG-softened edges around the same 50% contour; retain a narrow
    # antialiasing band instead of enlarging the original blur along with the art.
    matte = np.clip((matte - 0.28) / 0.44, 0, 1)
    matte = cv2.GaussianBlur(matte, (3, 3), 0.4)

    # Black RGB, including beneath transparent pixels, prevents white fringes
    # when the browser scales and composites this cutout over the campus scene.
    rgba = np.zeros((size[1], size[0], 4), dtype=np.uint8)
    rgba[:, :, 3] = (matte * 255).round().astype(np.uint8)
    output = ASSETS / "newforeground-4x.webp"
    Image.fromarray(rgba).save(output, lossless=True, method=6)
    print(f"Saved {output.name}: {size[0]}x{size[1]}, {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
