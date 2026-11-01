"""Create 4x hero assets with the official Real-ESRGAN general-x4v3 model.

Usage: python frontend/scripts/upscale_hero_assets.py --model PATH_TO_WEIGHTS
Asset-preparation dependencies: torch, numpy, opencv-python, Pillow.
Model architecture adapted from Real-ESRGAN; see licenses/Real-ESRGAN.txt.
"""

import argparse
import os
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.nn import functional as F

ASSETS = Path(__file__).resolve().parents[1] / "public" / "images" / "hero"
SCALE = 4


class SRVGGNetCompact(nn.Module):
    """The 32-convolution general-x4v3 inference architecture."""

    def __init__(self):
        super().__init__()
        self.body = nn.ModuleList([nn.Conv2d(3, 64, 3, 1, 1), nn.PReLU(64)])
        for _ in range(32):
            self.body.extend([nn.Conv2d(64, 64, 3, 1, 1), nn.PReLU(64)])
        self.body.append(nn.Conv2d(64, 3 * SCALE * SCALE, 3, 1, 1))
        self.upsampler = nn.PixelShuffle(SCALE)

    def forward(self, image):
        output = image
        for layer in self.body:
            output = layer(output)
        return self.upsampler(output) + F.interpolate(image, scale_factor=SCALE, mode="nearest")


@torch.inference_mode()
def upscale(
    model: nn.Module, pixels: np.ndarray, *, tile_size: int = 320, padding: int = 40
) -> np.ndarray:
    """Overlap tiles by the network's receptive field to avoid visible seams."""
    height, width = pixels.shape[:2]
    padded = np.pad(pixels, ((padding, padding), (padding, padding), (0, 0)), mode="reflect")
    output = np.empty((height * SCALE, width * SCALE, 3), dtype=np.uint8)
    for top in range(0, height, tile_size):
        for left in range(0, width, tile_size):
            bottom, right = min(top + tile_size, height), min(left + tile_size, width)
            tile = padded[top : bottom + 2 * padding, left : right + 2 * padding]
            tensor = torch.from_numpy(np.ascontiguousarray(tile.transpose(2, 0, 1)))
            tensor = tensor.unsqueeze(0).float().div_(255)
            tensor = tensor.contiguous(memory_format=torch.channels_last)
            restored = model(tensor).clamp_(0, 1)
            restored = restored[0].permute(1, 2, 0).mul_(255).round_().byte().cpu().numpy()
            offset = padding * SCALE
            output[top * SCALE : bottom * SCALE, left * SCALE : right * SCALE] = restored[
                offset : offset + (bottom - top) * SCALE,
                offset : offset + (right - left) * SCALE,
            ]
        print(f"  Processed {bottom}/{height} rows", flush=True)
    return output


def prepare_foreground(model: nn.Module) -> None:
    original = np.array(Image.open(ASSETS / "foreground-clean.webp").convert("RGBA"))
    alpha = original[:, :, 3]

    # Extend subject colors into transparent pixels before restoring RGB. Transparent
    # WebP pixels may otherwise contain arbitrary colors that bleed into the cutout.
    missing = (alpha < 128).astype(np.uint8)
    _, nearest = cv2.distanceTransformWithLabels(
        missing, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
    )
    colors = original[missing == 0, :3]
    extended = colors[np.maximum(nearest - 1, 0)]
    extended[alpha >= 128] = original[alpha >= 128, :3]
    restored = upscale(model, extended)

    # The silhouette geometry comes from the existing cutout, not a generated mask.
    large_alpha = cv2.resize(
        alpha, (restored.shape[1], restored.shape[0]), interpolation=cv2.INTER_LANCZOS4
    )
    result = Image.fromarray(np.dstack((restored, large_alpha)))
    result.save(ASSETS / "foreground-upscaled.webp", lossless=True, method=6)
    print(
        f"Foreground: {original.shape[1]}x{original.shape[0]} -> {result.width}x{result.height}",
        flush=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    args = parser.parse_args()
    torch.set_num_threads(min(6, os.cpu_count() or 1))

    model = SRVGGNetCompact()
    checkpoint = torch.load(args.model, map_location="cpu", weights_only=True)
    model.load_state_dict(checkpoint.get("params_ema", checkpoint.get("params", checkpoint)))
    model.eval().to(memory_format=torch.channels_last)

    original = Image.open(ASSETS / "background.png").convert("RGB")
    print("Upscaling background with Real-ESRGAN...", flush=True)
    result = Image.fromarray(upscale(model, np.array(original)))
    result.save(ASSETS / "background-upscaled.webp", quality=96, method=6)
    print(
        f"Background: {original.width}x{original.height} -> {result.width}x{result.height}",
        flush=True,
    )

    print("Upscaling transparent foreground...", flush=True)
    prepare_foreground(model)


if __name__ == "__main__":
    main()
