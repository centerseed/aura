import cv2
import numpy as np
import math

SIZE = 4096
OUT_SIZE = 1024

# Create alpha mask (0 = transparent)
mask = np.zeros((SIZE, SIZE), dtype=np.uint8)

# Coordinates for Z (padding inside 4096 is nice enough to breathe)
cx1, cy1 = 800, 800     # Top-Left
cx2, cy2 = 3296, 800    # Top-Right
cx3, cy3 = 800, 3296    # Bottom-Left
cx4, cy4 = 3296, 3296   # Bottom-Right

R = 240  # Border radius (half thickness). Thickness = 480

# 1. Draw joints
cv2.circle(mask, (cx1, cy1), R, 255, -1, cv2.LINE_AA)
cv2.circle(mask, (cx2, cy2), R, 255, -1, cv2.LINE_AA)
cv2.circle(mask, (cx3, cy3), R, 255, -1, cv2.LINE_AA)
cv2.circle(mask, (cx4, cy4), R, 255, -1, cv2.LINE_AA)

# 2. Draw Top Bar (connects P1 to P2)
cv2.rectangle(mask, (cx1, cy1 - R), (cx2, cy2 + R), 255, -1, cv2.LINE_AA)

# 3. Draw Bottom Bar (connects P3 to P4)
cv2.rectangle(mask, (cx3, cy3 - R), (cx4, cy4 + R), 255, -1, cv2.LINE_AA)

# 4. Draw Diagonal (connects P2 to P3)
dx = cx3 - cx2
dy = cy3 - cy2
length = math.hypot(dx, dy)
nx = -dy / length
ny = dx / length

p1 = (int(cx2 + nx*R), int(cy2 + ny*R))
p2 = (int(cx2 - nx*R), int(cy2 - ny*R))
p3 = (int(cx3 - nx*R), int(cy3 - ny*R))
p4 = (int(cx3 + nx*R), int(cy3 + ny*R))

pts = np.array([p1, p2, p3, p4], np.int32)
cv2.fillPoly(mask, [pts], 255, cv2.LINE_AA)

# Smooth mask further by a tiny blur since line_aa geometry might have 1px aliasing
# at 4096 resolution, a slight blur acts as advanced MSAA
mask = cv2.GaussianBlur(mask, (3,3), 0)

# Create Gradient RGB image
x = np.linspace(0, 1, SIZE)
y = np.linspace(0, 1, SIZE)
xv, yv = np.meshgrid(x, y)
t = (xv + yv) / 2.0  # diagonal gradient

B = np.zeros((SIZE, SIZE))
G = np.zeros((SIZE, SIZE))
r = np.zeros((SIZE, SIZE))

mask1 = t < 0.5
mask2 = t >= 0.5

# Gradient setup:
# Color 1 (Top Left): Violet Blue #667eea -> B:234, G:126, R:102
# Color 2 (Middle): Deep Purple #764ba2 -> B:162, G:75, R:118
# Color 3 (Bottom Right): Pink Purple #f093fb -> B:251, G:147, R:240

tf1 = t[mask1] * 2
B[mask1] = 234 * (1 - tf1) + 162 * tf1
G[mask1] = 126 * (1 - tf1) + 75 * tf1
r[mask1] = 102 * (1 - tf1) + 118 * tf1

tf2 = (t[mask2] - 0.5) * 2
B[mask2] = 162 * (1 - tf2) + 251 * tf2
G[mask2] = 75 * (1 - tf2) + 147 * tf2
r[mask2] = 118 * (1 - tf2) + 240 * tf2

img = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
img[:, :, 0] = B
img[:, :, 1] = G
img[:, :, 2] = r
img[:, :, 3] = mask # inject perfectly smooth anti-aliased mask!

# Resize down using high-quality internal interpolation (AREA)
out_img = cv2.resize(img, (OUT_SIZE, OUT_SIZE), interpolation=cv2.INTER_AREA)

cv2.imwrite('/Users/wubaizong/Naruvia/app/assets/app_icon_v2_backup.png', out_img)
print("Perfect vector-quality PNG generated!")
