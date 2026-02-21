from PIL import Image

img = Image.open('/Users/wubaizong/.gemini/antigravity/brain/49ce65d3-078a-433d-b985-c9fc11f03827/media__1771650676172.png').convert('RGB')
w, h = img.size

# Region centers (scaled)
top_bar = (int(w*0.5), int(h*0.2))
bottom_bar = (int(w*0.5), int(h*0.8))
d1 = (int(w*0.3), int(h*0.6))
d2 = (int(w*0.7), int(h*0.4))

for name, pt in [('Top', top_bar), ('Bottom', bottom_bar), ('D1', d1), ('D2', d2)]:
    r, g, b = img.getpixel(pt)
    print(f"{name}: #{r:02x}{g:02x}{b:02x}")
