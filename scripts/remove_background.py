#!/usr/bin/env python3
import sys
import os
# Add user site-packages to path
sys.path.insert(0, os.path.expanduser('~/Library/Python/3.9/lib/python/site-packages'))
"""
Background removal script using rembg
Called from Node.js to process selfies
"""

import sys
import os
import base64
import json
from pathlib import Path

try:
    from rembg import remove, new_session
except ImportError:
    print("Error: rembg not installed. Run: pip install rembg")
    sys.exit(1)

def remove_background(input_data, model_name='u2net_human_seg'):
    """
    Remove background from image data
    
    Args:
        input_data: Base64 encoded image data or file path
        model_name: Model to use ('u2net', 'u2net_human_seg', 'u2netp', 'u2net_cloth_seg')
    
    Returns:
        Base64 encoded processed image data
    """
    try:
        # Create session with specified model
        session = new_session(model_name)
        
        # Handle input data
        if isinstance(input_data, str) and len(input_data) > 50 and not os.path.exists(input_data):
            # Assume it's base64 data
            image_data = base64.b64decode(input_data)
        else:
            # Assume it's a file path
            with open(input_data, 'rb') as f:
                image_data = f.read()
        
        # Remove background
        output_data = remove(image_data, session=session)
        
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
        print("Usage: python remove_background.py <input_base64_or_path> [model_name]")
        sys.exit(1)
    
    input_data = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else 'u2net_human_seg'
    
    result = remove_background(input_data, model_name)
    
    # Output as JSON for Node.js to parse
    print(json.dumps(result))

if __name__ == '__main__':
    main()
