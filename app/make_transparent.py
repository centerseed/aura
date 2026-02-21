from PIL import Image
import itertools

# Read the last image provided by the user
img = Image.open('/Users/wubaizong/.gemini/antigravity/brain/7d792ed2-74f5-4e95-98fd-6f873062a44a/media__1771647416129.png')
img = img.convert('RGBA')
datas = img.getdata()

# Process purely based on near-black checkerboard removal
# Since the image is a screenshot of a transparent PNG over a checkerboard,
# we need to remove the checkerboard pattern (which contains dark grays)
# and any black background.
new_data = []

# This image has a lot of dark gray/black background (from the dark mode terminal preview)
# Logo colors are bright blue and bright purple.
for item in datas:
    # item is (R, G, B, A)
    # If the pixel is very dark (checkerboard or raw black), make it transparent
    if item[0] < 50 and item[1] < 50 and item[2] < 50:
        new_data.append((0, 0, 0, 0))
    else:
        new_data.append(item)

img.putdata(new_data)
# Let's crop to just the bounding box
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

# Save result back
img.save('/Users/wubaizong/Naruvia/app/assets/app_icon.png')
print("Successfully generated exact image with transparent background!")
