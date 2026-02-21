from rembg import remove
from PIL import Image

input_path = "/Users/wubaizong/.gemini/antigravity/brain/49ce65d3-078a-433d-b985-c9fc11f03827/zentropy_z_logo_transparent_1771650784829.png"
output_path = "/Users/wubaizong/Naruvia/app/assets/zentropy_logo_final_transparent.png"

input_img = Image.open(input_path)
output_img = remove(input_img)
output_img.save(output_path)
print("Finished!")
