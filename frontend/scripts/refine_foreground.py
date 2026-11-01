"""Rebuild the foreground matte, restore detail, and export a supersampled 6K cutout.

python frontend/scripts/refine_foreground.py --model PATH_TO_RealESRGAN_x4plus.pth
Uses 4x RRDB super-resolution for RGB, followed by 2x Lanczos export; the
transparency is reconstructed directly from the original white-matted screenshot.
"""

import argparse
import os
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image, ImageFilter
from rrdb_model import RRDBNet
from upscale_hero_assets import ASSETS, upscale


def reconstruct_matte() -> tuple[np.ndarray, np.ndarray]:
    original = Image.open(ASSETS / "foreground.png").convert("RGB")
    if original.size != (862, 508):
        raise ValueError("Update the crop coordinates for the new foreground source.")
    pixels = np.array(original)
    logo = np.zeros(pixels.shape[:2], dtype=np.uint8)
    cv2.circle(logo, (740, 396), 20, 255, -1)
    repaired = cv2.inpaint(pixels, logo, 5, cv2.INPAINT_TELEA)
    crop = repaired[64:421, 16:809].copy()

    # Confident opaque pixels exclude the white backdrop, including the small
    # holes beside the arms. Erosion avoids sampling contaminated edge colors.
    candidate = (crop.mean(axis=2) < 128).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, connectivity=8)
    if count < 2:
        raise ValueError("No foreground found.")
    core = (labels == 1 + stats[1:, cv2.CC_STAT_AREA].argmax()).astype(np.uint8)
    opaque = cv2.erode(core, np.ones((5, 5), dtype=np.uint8))
    _, nearest = cv2.distanceTransformWithLabels(
        1 - opaque, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
    )
    reference = crop[opaque > 0][np.maximum(nearest - 1, 0)].astype(np.float32)

    # Invert C = alpha*F + (1-alpha)*white across the entire edge band, not
    # just its outermost pixel. Carry real interior colors under the matte.
    ratios = (255 - crop.astype(np.float32)) / np.maximum(255 - reference, 1)
    alpha = np.clip(np.median(ratios, axis=2), 0, 1)
    support = cv2.dilate(core, np.ones((9, 9), dtype=np.uint8))
    alpha[(support == 0) | (crop.min(axis=2) > 249)] = 0
    alpha[opaque > 0] = 1
    clean = reference.astype(np.uint8)
    clean[opaque > 0] = crop[opaque > 0]
    return clean, alpha


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--reuse-detail", action="store_true")
    args = parser.parse_args()
    torch.set_num_threads(min(6, os.cpu_count() or 1))

    rgb, alpha = reconstruct_matte()
    Image.fromarray(np.dstack((rgb, (alpha * 255).astype(np.uint8)))).save(
        ASSETS / "foreground-defringed.webp", lossless=True, method=6
    )

    if args.reuse_detail:
        restored = np.array(Image.open(ASSETS / "foreground-detail-4x.webp").convert("RGB"))
        if restored.shape[:2] != (rgb.shape[0] * 4, rgb.shape[1] * 4):
            raise ValueError("The cached restoration does not match the source dimensions.")
    else:
        model = RRDBNet()
        checkpoint = torch.load(args.model, map_location="cpu", weights_only=True)
        model.load_state_dict(checkpoint.get("params_ema", checkpoint.get("params", checkpoint)))
        model.eval().to(memory_format=torch.channels_last)
        print("Restoring foreground with RealESRGAN_x4plus (RRDB)...", flush=True)
        restored = upscale(model, rgb, tile_size=192, padding=32)
        Image.fromarray(restored).save(
            ASSETS / "foreground-detail-4x.webp", lossless=True, method=6
        )

    # Remove bright ringing introduced by restoration at transparent boundaries.
    # Interior clothing detail is retained; only excess edge brightness is corrected.
    size4 = (restored.shape[1], restored.shape[0])
    alpha4 = cv2.resize(alpha, size4, interpolation=cv2.INTER_CUBIC)
    inside = cv2.distanceTransform((alpha4 > 0.99).astype(np.uint8), cv2.DIST_L2, 5)
    reference4 = cv2.resize(rgb, size4, interpolation=cv2.INTER_CUBIC).astype(np.float32)
    excess = restored.max(axis=2).astype(np.float32) - reference4.max(axis=2)
    correction = (np.clip((excess - 12) / 36, 0, 1) * (inside < 12))[:, :, None]
    corrected = restored * (1 - correction) + reference4 * correction
    restored = np.clip(corrected, 0, 255).astype(np.uint8)

    output_size = (rgb.shape[1] * 8, rgb.shape[0] * 8)
    detail = Image.fromarray(restored).resize(output_size, Image.Resampling.LANCZOS)
    detail = detail.filter(ImageFilter.UnsharpMask(radius=1.2, percent=65, threshold=3))
    matte = cv2.resize(alpha, output_size, interpolation=cv2.INTER_CUBIC)
    # Tighten the transition around the same 50% contour; no geometric shrink.
    matte = np.clip((matte - 0.06) / 0.88, 0, 1)
    matte = cv2.GaussianBlur(matte, (3, 3), 0.45)
    detail.putalpha(Image.fromarray((matte * 255).round().astype(np.uint8)))
    detail.save(ASSETS / "foreground-refined-8x.webp", lossless=True, method=6)
    print(f"Saved foreground-refined-8x.webp: {detail.width}x{detail.height}", flush=True)


if __name__ == "__main__":
    main()
