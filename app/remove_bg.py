from rembg import remove
from PIL import Image
import os

input_path = '/Users/wubaizong/.gemini/antigravity/brain/7d792ed2-74f5-4e95-98fd-6f873062a44a/zentropy_simple_icon_1771640276040.png'
output_path = '/Users/wubaizong/Naruvia/app/assets/app_icon.png'

print("Loading image...")
try:
    input_img = Image.open(input_path)
    print("Removing background with AI...")
    output_img = remove(input_img)
    
    # We want a little bit of padding, or just the bounding box.
    bbox = output_img.getbbox()
    if bbox:
        # add 10px padding
        padding = 10
        left = max(0, bbox[0] - padding)
        upper = max(0, bbox[1] - padding)
        right = min(output_img.width, bbox[2] + padding)
        lower = min(output_img.height, bbox[3] + padding)
        output_img = output_img.crop((left, upper, right, lower))
        
    output_img.save(output_path)
    print(f"Background removed perfectly! Saved to {output_path}")
except Exception as e:
    print(f"Error: {e}")

