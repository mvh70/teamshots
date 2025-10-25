#!/usr/bin/env python3
import sys
import os
import base64
import json
import io
import numpy as np
from PIL import Image
import torch
from transformers import AutoModelForImageSegmentation, AutoImageProcessor

def remove_background_rmbg2(input_data, model_name='briaai/RMBG-2.0'):
    """
    Remove background using RMBG v2.0 model from Bria AI
    """
    try:
        # Handle input data
        if isinstance(input_data, str) and len(input_data) > 50 and not os.path.exists(input_data):
            # Assume it's base64 data
            image_data = base64.b64decode(input_data)
        else:
            # Assume it's a file path
            with open(input_data, 'rb') as f:
                image_data = f.read()
        
        # Load image
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # Load model and processor
        processor = AutoImageProcessor.from_pretrained(model_name)
        model = AutoModelForImageSegmentation.from_pretrained(model_name)
        
        # Process image
        inputs = processor(images=image, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model(**inputs)
            mask = outputs.logits.sigmoid().squeeze().cpu().numpy()
        
        # Apply mask to create transparent background
        image_array = np.array(image)
        mask_3d = np.stack([mask] * 3, axis=-1)
        
        # Create RGBA image with transparency
        rgba_image = np.concatenate([image_array, (mask_3d * 255).astype(np.uint8)[:, :, :1]], axis=-1)
        
        # Convert back to bytes
        output_image = Image.fromarray(rgba_image, 'RGBA')
        output_buffer = io.BytesIO()
        output_image.save(output_buffer, format='PNG')
        output_data = output_buffer.getvalue()
        
        # Convert to base64
        output_base64 = base64.b64encode(output_data).decode('utf-8')
        
        return {
            'success': True,
            'data': output_base64,
            'size': len(output_data)
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    if len(sys.argv) < 2:
        print("Usage: python remove_background_rmbg2.py <input_base64_or_path>")
        sys.exit(1)
    
    input_data = sys.argv[1]
    
    result = remove_background_rmbg2(input_data)
    
    # Output as JSON for Node.js to parse
    print(json.dumps(result))

if __name__ == '__main__':
    main()
