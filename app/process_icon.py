import cv2
import numpy as np

# Load image
img = cv2.imread('/Users/wubaizong/.gemini/antigravity/brain/7d792ed2-74f5-4e95-98fd-6f873062a44a/zentropy_simple_icon_1771640276040.png', cv2.IMREAD_UNCHANGED)

if img.shape[2] == 3:
    # Add alpha channel if missing
    img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

# Convert to grayscale
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Threshold to find non-white/non-offwhite pixels
# The background is very light, so we can use a threshold near 255.
# Let's say anything above 245 is background.
_, thresh = cv2.threshold(gray, 248, 255, cv2.THRESH_BINARY_INV)

# Find contours of the logo
contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

if contours:
    # Find the largest contour (the shape)
    c = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(c)
    
    # We want to crop slightly around the bounding box to keep some margin, 
    # but the user said "png去背", so they want transparent background.
    # We can create a mask
    mask = np.zeros_like(gray)
    cv2.drawContours(mask, contours, -1, 255, -1)
    
    # Smooth the mask to avoid jagged edges
    mask = cv2.GaussianBlur(mask, (3, 3), 0)
    
    # Alternatively, simply make all white/off-white pixels transparent:
    # A vector style image with a sharp boundary.
    # Create mask where pixels are not close to white.
    # B, G, R
    white_thresh = 240
    bg_mask = (img[:, :, 0] > white_thresh) & (img[:, :, 1] > white_thresh) & (img[:, :, 2] > white_thresh)
    
    # make those pixels fully transparent
    img[bg_mask, 3] = 0
    
    # Crop to the bounding box with some padding (optional, let's keep original size for now but remove background)
    
    # Save the result
    cv2.imwrite('/Users/wubaizong/Naruvia/app/assets/app_icon.png', img)
    print("Processed and saved transparent icon.")
else:
    print("Could not find contour.")

