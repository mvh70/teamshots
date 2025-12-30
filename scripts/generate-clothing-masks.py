#!/usr/bin/env python3
"""
Generate clothing layer masks from existing clothing images.

This script uses color-based segmentation and edge detection to automatically
create mask images for each clothing layer (topLayer, baseLayer, bottom, shoes).

Requirements:
    pip install opencv-python numpy pillow

Usage:
    python scripts/generate-clothing-masks.py
"""

import cv2
import numpy as np
from pathlib import Path
from PIL import Image
import sys

# Clothing images to process
CLOTHING_IMAGES = [
    ("startup", "hoodie"),
    ("startup", "polo"),
    ("startup", "button_down"),
    ("business", "casual"),
]

# Paths
PUBLIC_DIR = Path(__file__).parent.parent / "public" / "images" / "clothing"
MASKS_DIR = PUBLIC_DIR / "masks"

def create_mask_directories():
    """Create masks directory if it doesn't exist."""
    MASKS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"✓ Created masks directory: {MASKS_DIR}")

def remove_background(image_path):
    """
    Remove white/light background from clothing image.
    Returns a binary mask where white = clothing, black = background.
    """
    # Read image
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"✗ Failed to load image: {image_path}")
        return None

    # Convert to RGB (opencv uses BGR)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Create mask: anything darker than white background
    # Adjust threshold (230) if needed - lower value = more aggressive
    _, mask = cv2.threshold(gray, 230, 255, cv2.THRESH_BINARY_INV)

    # Apply morphological operations to clean up mask
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)  # Fill holes
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)   # Remove noise

    return mask

def split_clothing_layers(mask, image_height):
    """
    Split the clothing mask into separate layers based on vertical position.

    Returns dict with masks for:
    - topLayer: upper 40% (jacket/hoodie/polo)
    - baseLayer: middle area where collar/cuffs might be visible
    - bottom: lower 50% (pants/skirt)
    """
    layers = {}
    h, w = mask.shape

    # TopLayer: upper portion (0% to 45% of image height)
    top_mask = np.zeros_like(mask)
    top_mask[0:int(h * 0.45), :] = mask[0:int(h * 0.45), :]
    layers['topLayer'] = top_mask

    # BaseLayer: Look for white pixels in the "collar" region (5% to 35% height)
    # This is where shirt collars/cuffs typically appear
    base_mask = np.zeros_like(mask)
    collar_region = mask[int(h * 0.05):int(h * 0.35), :]
    # Only include pixels that are in the clothing mask
    base_mask[int(h * 0.05):int(h * 0.35), :] = collar_region
    layers['baseLayer'] = base_mask

    # Bottom: lower portion (45% to 100% of image height)
    bottom_mask = np.zeros_like(mask)
    bottom_mask[int(h * 0.45):, :] = mask[int(h * 0.45):, :]
    layers['bottom'] = bottom_mask

    return layers

def save_mask(mask, output_path):
    """Save mask as white-on-transparent PNG."""
    # Create RGBA image (white with transparency based on mask)
    h, w = mask.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)

    # Set RGB to white where mask is white
    rgba[:, :, 0:3] = 255  # RGB = white
    rgba[:, :, 3] = mask   # Alpha = mask (white=opaque, black=transparent)

    # Convert to PIL and save
    img = Image.fromarray(rgba, 'RGBA')
    img.save(output_path)
    print(f"  ✓ Saved: {output_path.name}")

def process_clothing_image(style, detail):
    """Process a single clothing image and generate all layer masks."""
    template_id = f"{style}-{detail}"
    image_path = PUBLIC_DIR / f"{template_id}.png"

    if not image_path.exists():
        print(f"✗ Image not found: {image_path}")
        return False

    print(f"\nProcessing: {template_id}")

    # Remove background to get clothing mask
    clothing_mask = remove_background(image_path)
    if clothing_mask is None:
        return False

    # Get image dimensions
    img = cv2.imread(str(image_path))
    h, w = img.shape[:2]

    # Split into layers
    layers = split_clothing_layers(clothing_mask, h)

    # Save each layer mask
    for layer_name, layer_mask in layers.items():
        # Skip baseLayer if it's mostly empty (single-layer garments)
        if layer_name == 'baseLayer':
            white_pixels = np.sum(layer_mask == 255)
            if white_pixels < (h * w * 0.01):  # Less than 1% white pixels
                print(f"  - Skipping {layer_name} (no visible shirt underneath)")
                continue

        # Skip if layer is completely empty
        if np.sum(layer_mask) == 0:
            print(f"  - Skipping {layer_name} (empty)")
            continue

        output_path = MASKS_DIR / f"{template_id}-{layer_name}.png"
        save_mask(layer_mask, output_path)

    return True

def generate_preview_html():
    """Generate an HTML file to preview all generated masks."""
    html_content = """<!DOCTYPE html>
<html>
<head>
    <title>Clothing Masks Preview</title>
    <style>
        body { font-family: system-ui; padding: 20px; background: #f5f5f5; }
        .item {
            display: inline-block;
            margin: 20px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .item h3 { margin-top: 0; }
        .mask-preview {
            display: inline-block;
            margin: 10px;
            text-align: center;
        }
        .mask-preview img {
            width: 200px;
            height: auto;
            border: 1px solid #ddd;
            background:
                linear-gradient(45deg, #ccc 25%, transparent 25%),
                linear-gradient(-45deg, #ccc 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #ccc 75%),
                linear-gradient(-45deg, transparent 75%, #ccc 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
        .mask-preview p { margin: 5px 0; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <h1>Generated Clothing Masks</h1>
    <p>White areas will receive color overlay. Transparent areas won't.</p>
"""

    for style, detail in CLOTHING_IMAGES:
        template_id = f"{style}-{detail}"
        html_content += f"""
    <div class="item">
        <h3>{style.title()} - {detail.replace('_', ' ').title()}</h3>
"""
        for layer in ['topLayer', 'baseLayer', 'bottom', 'shoes']:
            mask_path = MASKS_DIR / f"{template_id}-{layer}.png"
            if mask_path.exists():
                html_content += f"""
        <div class="mask-preview">
            <img src="masks/{template_id}-{layer}.png" alt="{layer}">
            <p>{layer}</p>
        </div>
"""
        html_content += """
    </div>
"""

    html_content += """
</body>
</html>
"""

    preview_path = PUBLIC_DIR / "masks-preview.html"
    with open(preview_path, 'w') as f:
        f.write(html_content)

    print(f"\n✓ Preview generated: {preview_path}")
    print(f"  Open in browser: file://{preview_path}")

def main():
    """Main execution."""
    print("=" * 60)
    print("Clothing Mask Generator")
    print("=" * 60)

    # Create masks directory
    create_mask_directories()

    # Process each clothing image
    success_count = 0
    for style, detail in CLOTHING_IMAGES:
        if process_clothing_image(style, detail):
            success_count += 1

    print("\n" + "=" * 60)
    print(f"✓ Processed {success_count}/{len(CLOTHING_IMAGES)} images")
    print("=" * 60)

    # Generate preview HTML
    generate_preview_html()

    print("\nNext steps:")
    print("1. Open masks-preview.html to review the generated masks")
    print("2. If masks need adjustment, you can manually edit them in Photopea")
    print("3. The masks are ready to use in the ClothingColorPreview component!")

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
