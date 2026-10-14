from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
for size in (192, 512):
    image = Image.new('RGB', (size,size), '#116B5B')
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype('C:/Windows/Fonts/georgiab.ttf',int(size*.66))
    draw.text((size*.5,size*.48),'A',font=font,fill='#F8F6F0',anchor='mm')
    draw.ellipse((size*.77,size*.13,size*.89,size*.25),fill='#F5D776')
    image.save(Path('public')/f'icon-{size}.png')
