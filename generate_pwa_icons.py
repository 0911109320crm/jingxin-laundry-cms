"""產生 PWA icon PNG（192x192 + 512x512）放到 app/public/

照 icon.svg 設計重畫：紫色圓角背景 + 白色洗衣機輪廓
"""
from PIL import Image, ImageDraw

BRAND = "#4f46e5"
WHITE = "#ffffff"


def draw_icon(size: int) -> Image.Image:
    """畫一張 size x size 的 PWA icon"""
    # 512x512 原始尺寸下的座標，等比放大縮小
    scale = size / 512
    img = Image.new("RGB", (size, size), BRAND)
    draw = ImageDraw.Draw(img)

    # 圓角矩形背景（已是 BRAND 色但要 mask 出圓角）
    # 直接畫個 antialias 圓角 mask
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    bg_draw.rounded_rectangle([(0, 0), (size, size)], radius=int(96 * scale), fill=BRAND)

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.paste(bg, (0, 0), bg)
    draw = ImageDraw.Draw(img)

    sw = max(2, int(20 * scale))  # stroke width

    # 機身外框 (rect x=116 y=80 w=280 h=352 r=32)
    x0 = int(116 * scale)
    y0 = int(80 * scale)
    x1 = int((116 + 280) * scale)
    y1 = int((80 + 352) * scale)
    draw.rounded_rectangle([(x0, y0), (x1, y1)], radius=int(32 * scale), outline=WHITE, width=sw)

    # 大圓圈 (洗衣機門) cx=256 cy=276 r=100
    cx, cy = int(256 * scale), int(276 * scale)
    r1 = int(100 * scale)
    draw.ellipse([(cx - r1, cy - r1), (cx + r1, cy + r1)], outline=WHITE, width=sw)

    # 內圈 r=58
    r2 = int(58 * scale)
    draw.ellipse([(cx - r2, cy - r2), (cx + r2, cy + r2)], outline=WHITE, width=sw)

    # 三顆按鈕 (頂部)
    for bx, br in [(172, 10), (220, 10), (340, 14)]:
        cx2, cy2 = int(bx * scale), int(140 * scale)
        r = int(br * scale)
        draw.ellipse([(cx2 - r, cy2 - r), (cx2 + r, cy2 + r)], fill=WHITE)

    # PNG 轉 RGB（PWA 要求不能有 alpha）
    final = Image.new("RGB", (size, size), BRAND)
    final.paste(img, (0, 0), img)
    return final


for size in (192, 512):
    img = draw_icon(size)
    out = f"app/public/icon-{size}.png"
    img.save(out, "PNG", optimize=True)
    print(f"  ✅ {out} ({size}x{size})")

print("\n完成。push 到 vercel 後 PWA install 提示應該會出現。")
