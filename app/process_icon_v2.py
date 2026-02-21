import cv2
import numpy as np

# Load the original image
img_path = '/Users/wubaizong/.gemini/antigravity/brain/7d792ed2-74f5-4e95-98fd-6f873062a44a/zentropy_simple_icon_1771640276040.png'
img = cv2.imread(img_path)

if img is None:
    print("Could not load image")
    exit(1)

# Convert to grayscale
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Threshold to get the Z shape. Background is white-ish, shape is purple (darker)
# Let's use a threshold of 240.
_, binary = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)

# Find contours
contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

if not contours:
    print("No contours found")
    exit(1)

# Largest contour should be the Z shape
c = max(contours, key=cv2.contourArea)

# Approximate contour to sharp polygons since the Z is made of straight lines
epsilon = 0.002 * cv2.arcLength(c, True)
approx = cv2.approxPolyDP(c, epsilon, True)

# Create a high-quality anti-aliased mask
# We'll create a single channel float image or just uint8 with LINE_AA
mask = np.zeros((img.shape[0], img.shape[1]), dtype=np.uint8)
cv2.fillPoly(mask, [approx], 255, lineType=cv2.LINE_AA)

# Now, we might want to dilate or blur slightly to make the edge perfectly blend,
# but fillPoly with LINE_AA is usually quite good.
# Let's blur the mask slightly for smoother edges
mask = cv2.GaussianBlur(mask, (3, 3), 0.5)

# Convert original to BGRA
result = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

# Apply the mask to the alpha channel
result[:, :, 3] = mask

# Crop the image to the bounding rectangle of the contour, adding some padding
x, y, w, h = cv2.boundingRect(approx)
padding = 40
x1 = max(0, x - padding)
y1 = max(0, y - padding)
x2 = min(img.shape[1], x + w + padding)
y2 = min(img.shape[0], y + h + padding)

cropped = result[y1:y2, x1:x2]

# Save the final image
out_path = '/Users/wubaizong/Naruvia/app/assets/app_icon.png'
cv2.imwrite(out_path, cropped)
print("Successfully processed and saved to", out_path)

