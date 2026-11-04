# Hero asset preparation

The website serves prebuilt WebP images. These scripts are offline preparation tools;
the development server does not run an upscaling model.

## Current foreground: the supplied silhouette JPEG

```powershell
python frontend/scripts/prepare_new_foreground.py
```

Requires Pillow, NumPy, and OpenCV. The script turns `newforeground.jpeg`
(1024 × 410) into `newforeground-4x.webp` (**4096 × 1640**), which the hero serves.
It removes the Gemini mark from the solid ground, extracts the white background,
cleans JPEG speckles, and supersamples the antialiased silhouette edges. Black RGB
under transparent pixels prevents white halos. The output is lossless WebP with
transparency; 4x refers to output sampling, not newly reconstructed photographic detail.

The original JPEG is retained as the reproducible input. The following workflows
describe the earlier photographic foreground and the current campus background.

## Earlier foreground screenshot

```powershell
python frontend/scripts/prepare_hero_assets.py
```

This uses Pillow, NumPy, and OpenCV to crop the supplied screenshot, repair the Gemini
mark, and extract a transparent foreground. Coordinates are specific to the current source.

## Generate the high-resolution hero images

Download the official [Real-ESRGAN general-x4v3 weights](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth)
to a local model cache, then run:

```powershell
python frontend/scripts/upscale_hero_assets.py --model "path/to/realesr-general-x4v3.pth"
```

Requires PyTorch, Pillow, NumPy, and OpenCV in the Python environment running the script.
The architecture is adapted from [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN);
its license is included in `licenses/Real-ESRGAN.txt`.

| Source | Output | Dimensions |
| --- | --- | --- |
| `background.png` | `background-upscaled.webp` | 967 × 533 → 3868 × 2132 |
| `foreground-clean.webp` | `foreground-upscaled.webp` | 793 × 357 → 3172 × 1428 |

RGB detail is reconstructed using the 4× model. The foreground alpha channel is
resampled separately from its existing mask to preserve the cutout's shape. The
background uses high-quality WebP; the foreground uses lossless WebP with transparency.

The hero serves these prepared files directly to avoid a second resizing/compression
pass. Source filenames and high-resolution output filenames are separate.

## Earlier refined full-size foreground

The earlier photographic foreground used a separate, higher-detail restoration:

```powershell
python frontend/scripts/refine_foreground.py --model "path/to/RealESRGAN_x4plus.pth"
```

Use the official [RealESRGAN_x4plus weights](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth).
This rebuilds the transparency from the original screenshot, removes white-matte
contamination around the figures and arm openings, and restores RGB with the larger
RRDB model. A 2x Lanczos export follows the model's native 4x restoration, producing
`foreground-refined-8x.webp` at **6344 × 2856**. This is 8x output sampling, not an
8x neural model. The contour is antialiased independently at the output resolution.

`rrdb_model.py` is adapted from BasicSR's fixed 4x RRDB architecture. Its Apache-2.0
license and attribution are included in `licenses/BasicSR-Apache-2.0.txt`.
