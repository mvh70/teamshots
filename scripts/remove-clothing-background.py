#!/usr/bin/env python3
"""
Remove white background from clothing images and make them transparent.

This script processes clothing layer images (toplayer, baselayer, bottom, shoes)
and removes the white/light background, creating PNG files with transparency.

Requirements:
    pip install opencv-python numpy pillow

Usage:
    python scripts/remove-clothing-background.py
"""

import cv2
import numpy as np
from pathlib import Path
from PIL import Image
import sys

# Clothing layer images to process
CLOTHING_IMAGES = [
    "startup-hoodie-toplayer",
    "startup-hoodie-bottom",
    # Add more as you create them:
    # "startup-hoodie-baselayer",
    # "startup-polo-toplayer",
    # "startup-polo-bottom",
    # etc.
]

# Paths
PUBLIC_DIR = Path(__file__).parent.parent / "public" / "images" / "clothing"

def remove_white_background(image_path, output_path):
    """
    Remove white/light background from image and save with transparency.
    Returns True if successful, False otherwise.
    """
    print(f"\nProcessing: {image_path.name}")

    # Read image
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"  ✗ Failed to load image: {image_path}")
        return False

    # Convert to RGB (opencv uses BGR)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Convert to grayscale for thresholding
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Create mask: anything darker than near-white is clothing
    # Threshold: 240 = very close to white (adjust if needed)
    # Lower value = more aggressive (keeps more pixels)
    # Higher value = less aggressive (removes more pixels)
    _, mask = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)

    # Apply morphological operations to clean up mask
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)  # Fill small holes
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)   # Remove small noise

    # Create RGBA image
    h, w = img_rgb.shape[:2]
    rgba = np.zeros((h, w, 4), dtype=np.uint8)

    # Copy RGB channels
    rgba[:, :, 0:3] = img_rgb

    # Set alpha channel based on mask
    rgba[:, :, 3] = mask

    # Convert to PIL and save
    pil_img = Image.fromarray(rgba, 'RGBA')
    pil_img.save(output_path)

    print(f"  ✓ Saved: {output_path.name}")
    return True

def main():
    """Main execution."""
    print("=" * 60)
    print("Clothing Background Remover")
    print("=" * 60)

    success_count = 0
    for image_name in CLOTHING_IMAGES:
        input_path = PUBLIC_DIR / f"{image_name}.png"
        output_path = PUBLIC_DIR / f"{image_name}.png"  # Overwrite original

        if not input_path.exists():
            print(f"\n✗ Image not found: {input_path}")
            continue

        if remove_white_background(input_path, output_path):
            success_count += 1

    print("\n" + "=" * 60)
    print(f"✓ Processed {success_count}/{len(CLOTHING_IMAGES)} images")
    print("=" * 60)

    print("\nNext steps:")
    print("1. Check the images - they should now have transparent backgrounds")
    print("2. Test the color preview in your app")
    print("3. If background removal is too aggressive or not enough, adjust the")
    print("   threshold value (240) in the script and run again")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
