import numpy as np
from PIL import Image, ImageDraw

SIZE = 1024
SCALE = 8
S = SIZE * SCALE

# Initialize ultra high-res masks
mask_top = Image.new("L", (S, S), 0)
mask_mid = Image.new("L", (S, S), 0)
mask_bot = Image.new("L", (S, S), 0)

d_top = ImageDraw.Draw(mask_top)
d_mid = ImageDraw.Draw(mask_mid)
d_bot = ImageDraw.Draw(mask_bot)

# Exact mathematical points mapped from the geometric reference design
t_pts = [(150*SCALE, 240*SCALE), (654*SCALE, 240*SCALE), (494*SCALE, 400*SCALE), (150*SCALE, 400*SCALE)]
m_pts = [(694*SCALE, 240*SCALE), (874*SCALE, 240*SCALE), (330*SCALE, 784*SCALE), (150*SCALE, 784*SCALE)]
b_pts = [(530*SCALE, 624*SCALE), (874*SCALE, 624*SCALE), (874*SCALE, 784*SCALE), (370*SCALE, 784*SCALE)]

d_top.polygon(t_pts, fill=255)
d_mid.polygon(m_pts, fill=255)
d_bot.polygon(b_pts, fill=255)

print("Downscaling masks with LANCZOS for perfect anti-aliasing...")
mask_top = mask_top.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
mask_mid = mask_mid.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
mask_bot = mask_bot.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

m_top_arr = np.array(mask_top) / 255.0
m_mid_arr = np.array(mask_mid) / 255.0
m_bot_arr = np.array(mask_bot) / 255.0

print("Generating beautiful gradients...")
x_grid, y_grid = np.meshgrid(np.arange(SIZE), np.arange(SIZE))

def mix(c1, c2, frac):
    frac = np.clip(frac, 0, 1)
    if len(frac.shape) == 2:
        frac = frac[:, :, None]
    return c1 * (1 - frac) + c2 * frac

# Violet Blue (#667eea) to Deep Purple (#764ba2)
c_t1 = np.array([102, 126, 234])
c_t2 = np.array([115, 100, 210])
c_m1 = np.array([110, 105, 215])
c_m2 = np.array([125,  80, 180])
c_b1 = np.array([120,  90, 190])
c_b2 = np.array([118,  75, 162])

frac_top = (x_grid - 150) / 504.0
c_top = mix(c_t1, c_t2, frac_top)

v_mid = np.array([150 - 694, 784 - 240])
len_mid = np.sum(v_mid**2)
dot_mid = (x_grid - 694) * v_mid[0] + (y_grid - 240) * v_mid[1]
frac_mid = dot_mid / len_mid
c_mid = mix(c_m1, c_m2, frac_mid)

frac_bot = (x_grid - 370) / 504.0
c_bot = mix(c_b1, c_b2, frac_bot)

out_rgb = np.zeros((SIZE, SIZE, 3))
out_rgb += c_top * m_top_arr[:, :, None]
out_rgb += c_mid * m_mid_arr[:, :, None]
out_rgb += c_bot * m_bot_arr[:, :, None]

m_all = np.maximum(np.maximum(m_top_arr, m_mid_arr), m_bot_arr)

img_arr = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
# Pre-multiplied alpha or exact values. We just store the exact values.
# Where m_all == 0, color will be 0, so it's fine.
img_arr[:, :, 0:3] = np.clip(out_rgb, 0, 255).astype(np.uint8)
img_arr[:, :, 3] = (m_all * 255).astype(np.uint8)

# Add a final crop to bound exactly over the logo like a true icon
out = Image.fromarray(img_arr)
bbox = out.getbbox()
if bbox:
    out = out.crop(bbox)

output_path = '/Users/wubaizong/Naruvia/app/assets/app_icon.png'
out.save(output_path)
print(f"Direct mathematically perfect transparent PNG drawn to {output_path}!")
