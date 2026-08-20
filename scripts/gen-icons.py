"""为 Capacitor Android 工程生成应用图标（从 www/icon.png 缩放）。"""
import os
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "www", "icon.png")
MIPMAP_DIR = os.path.join(BASE, "android", "app", "src", "main", "res")

# density -> 像素尺寸
DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}

img = Image.open(SRC)
for density, size in DENSITIES.items():
    icon = img.resize((size, size), Image.LANCZOS)
    for name in ("ic_launcher", "ic_launcher_round"):
        out = os.path.join(MIPMAP_DIR, f"mipmap-{density}", f"{name}.png")
        icon.save(out)
        print(f"wrote {out}")
