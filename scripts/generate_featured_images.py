import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_shadow(image_size, border_radius=20, offset=(0, 20), blur=40, color=(15, 23, 42, 45)):
    w, h = image_size
    pad = blur * 2
    sw, sh = w + pad * 2, h + pad * 2
    shadow = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    rect = [pad + offset[0], pad + offset[1], pad + offset[0] + w, pad + offset[1] + h]
    draw.rounded_rectangle(rect, radius=border_radius, fill=color)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    return shadow, pad

def round_corners(image, radius=20, border_color=(226, 232, 240, 255), border_width=2):
    image = image.convert("RGBA")
    w, h = image.size
    
    mask = Image.new("L", (w, h), 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.rounded_rectangle([0, 0, w, h], radius=radius, fill=255)
    
    output = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    output.paste(image, (0, 0), mask=mask)
    
    if border_width > 0 and border_color:
        draw_border = ImageDraw.Draw(output)
        draw_border.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, outline=border_color, width=border_width)
        
    return output

def build_gradient(width, height, top_color, bottom_color):
    top_r, top_g, top_b = top_color
    bot_r, bot_g, bot_b = bottom_color
    
    gradient = Image.new("RGBA", (width, height))
    draw = ImageDraw.Draw(gradient)
    for y in range(height):
        factor = y / height
        r = int(top_r + (bot_r - top_r) * factor)
        g = int(top_g + (bot_g - top_g) * factor)
        b = int(top_b + (bot_b - top_b) * factor)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))
    return gradient.convert("RGB")

def get_fonts():
    font_bold = "C:/Windows/Fonts/segoeuib.ttf"
    font_reg = "C:/Windows/Fonts/segoeui.ttf"
    
    return {
        "badge": ImageFont.truetype(font_bold, 30),
        "title": ImageFont.truetype(font_bold, 68),
        "sub": ImageFont.truetype(font_reg, 34),
        "pill": ImageFont.truetype(font_bold, 28),
        "pill_sm": ImageFont.truetype(font_bold, 24),
        "card_title": ImageFont.truetype(font_bold, 32),
        "card_desc": ImageFont.truetype(font_reg, 24),
        "footer": ImageFont.truetype(font_reg, 24),
    }

def generate_featured_1():
    print("Generating Featured Image 1 (2400 x 1800)...")
    W, H = 2400, 1800
    fonts = get_fonts()
    
    # 1. Background
    bg = build_gradient(W, H, (249, 250, 252), (238, 242, 248))
    canvas = bg.convert("RGBA")
    
    # Glows
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse([150, 500, 1000, 1400], fill=(16, 185, 129, 30)) # Emerald
    glow_draw.ellipse([1350, 500, 2250, 1400], fill=(124, 58, 237, 30)) # Canva purple
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    canvas = Image.alpha_composite(canvas, glow)
    draw = ImageDraw.Draw(canvas)
    
    # 2. Header
    badge_text = "GOOGLE SHEETS + CANVA SYNC"
    badge_bbox = fonts["badge"].getbbox(badge_text)
    bw = badge_bbox[2] - badge_bbox[0] + 60
    bh = 54
    bx = (W - bw) // 2
    by = 120
    
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=27, fill=(255, 255, 255, 240), outline=(203, 213, 225, 255), width=2)
    # Green live dot
    draw.ellipse([bx + 20, by + 18, bx + 36, by + 34], fill=(16, 185, 129, 255))
    draw.text((bx + 46, by + 10), badge_text, font=fonts["badge"], fill=(30, 41, 59, 255))
    
    title_text = "Sync Spreadsheet Data Directly into Canva Designs"
    t_bbox = fonts["title"].getbbox(title_text)
    tw = t_bbox[2] - t_bbox[0]
    draw.text(((W - tw) // 2, 205), title_text, font=fonts["title"], fill=(15, 23, 42, 255))
    
    sub_text = "Connect Google Sheets to update menus, product prices, and design elements in real time"
    s_bbox = fonts["sub"].getbbox(sub_text)
    sw = s_bbox[2] - s_bbox[0]
    draw.text(((W - sw) // 2, 305), sub_text, font=fonts["sub"], fill=(71, 85, 105, 255))
    
    # 3. Floating Cards
    img1_canva = Image.open("Screenshot 2026-10-24 224725.png") # (1650, 742)
    img2_sheet = Image.open("Screenshot 2026-10-24 224739.png") # (798, 673)
    
    # Left Card: Google Sheets
    frame_sheet_w = 780
    sheet_scaled_w = 756
    sheet_scaled_h = int(img2_sheet.height * (sheet_scaled_w / img2_sheet.width))
    sheet_resized = img2_sheet.resize((sheet_scaled_w, sheet_scaled_h), Image.Resampling.LANCZOS)
    
    frame_sheet_h = 70 + sheet_scaled_h + 90
    frame_sheet = Image.new("RGBA", (frame_sheet_w, frame_sheet_h), (255, 255, 255, 255))
    s_draw = ImageDraw.Draw(frame_sheet)
    
    # Window Header
    s_draw.rectangle([0, 0, frame_sheet_w, 65], fill=(241, 245, 249, 255))
    s_draw.ellipse([24, 24, 40, 40], fill=(239, 68, 68, 255))
    s_draw.ellipse([48, 24, 64, 40], fill=(245, 158, 11, 255))
    s_draw.ellipse([72, 24, 88, 40], fill=(16, 185, 129, 255))
    s_draw.text((105, 18), "MyMenu — Google Sheets", font=fonts["pill"], fill=(51, 65, 85, 255))
    
    frame_sheet.paste(sheet_resized, (12, 72))
    
    # Bottom banner in Sheet Card
    s_bot_y = 72 + sheet_scaled_h + 10
    s_draw.rounded_rectangle([12, s_bot_y, frame_sheet_w - 12, s_bot_y + 65], radius=12, fill=(240, 253, 244, 255), outline=(187, 247, 208, 255), width=1)
    
    # Draw nice vector checkmark
    s_draw.ellipse([26, s_bot_y + 16, 56, s_bot_y + 46], fill=(16, 185, 129, 255))
    s_draw.line([(34, s_bot_y + 31), (40, s_bot_y + 37), (49, s_bot_y + 24)], fill=(255, 255, 255, 255), width=3)
    s_draw.text((68, s_bot_y + 17), "7 rows loaded & ready to sync", font=fonts["pill"], fill=(21, 128, 61, 255))
    
    rounded_sheet = round_corners(frame_sheet, radius=24, border_color=(203, 213, 225, 255), border_width=2)
    
    # Right Card: Canva App in Action
    frame_canva_w = 1380
    canva_scaled_w = frame_canva_w - 24
    canva_scaled_h = int(img1_canva.height * (canva_scaled_w / img1_canva.width))
    canva_resized = img1_canva.resize((canva_scaled_w, canva_scaled_h), Image.Resampling.LANCZOS)
    
    frame_canva_h = 70 + canva_scaled_h + 90
    frame_canva = Image.new("RGBA", (frame_canva_w, frame_canva_h), (255, 255, 255, 255))
    c_draw = ImageDraw.Draw(frame_canva)
    
    # Window Header
    c_draw.rectangle([0, 0, frame_canva_w, 65], fill=(241, 245, 249, 255))
    c_draw.ellipse([24, 24, 40, 40], fill=(239, 68, 68, 255))
    c_draw.ellipse([48, 24, 64, 40], fill=(245, 158, 11, 255))
    c_draw.ellipse([72, 24, 88, 40], fill=(16, 185, 129, 255))
    c_draw.text((105, 18), "Canva Editor — SheetFlow Live Sync", font=fonts["pill"], fill=(51, 65, 85, 255))
    
    frame_canva.paste(canva_resized, (12, 72))
    
    # Bottom banner in Canva Card
    c_bot_y = 72 + canva_scaled_h + 10
    c_draw.rounded_rectangle([12, c_bot_y, frame_canva_w - 12, c_bot_y + 65], radius=12, fill=(245, 243, 255, 255), outline=(221, 214, 254, 255), width=1)
    
    # Draw nice vector arrow circle
    c_draw.ellipse([26, c_bot_y + 16, 56, c_bot_y + 46], fill=(124, 58, 237, 255))
    c_draw.line([(34, c_bot_y + 31), (46, c_bot_y + 31)], fill=(255, 255, 255, 255), width=3)
    c_draw.line([(41, c_bot_y + 25), (47, c_bot_y + 31), (41, c_bot_y + 37)], fill=(255, 255, 255, 255), width=3)
    c_draw.text((68, c_bot_y + 17), "Selected price ($14,90) synced in real-time from Row #1", font=fonts["pill"], fill=(109, 40, 217, 255))
    
    rounded_canva = round_corners(frame_canva, radius=24, border_color=(203, 213, 225, 255), border_width=2)
    
    # Positioning
    pos_y = 440
    pos_sheet_x = 90
    pos_canva_x = 930
    
    # Sheet Shadow & Paste
    sh_sheet, pad_s = create_shadow(rounded_sheet.size, border_radius=24, offset=(0, 25), blur=45, color=(15, 23, 42, 35))
    canvas.paste(sh_sheet, (pos_sheet_x - pad_s, pos_y - pad_s), mask=sh_sheet)
    canvas.paste(rounded_sheet, (pos_sheet_x, pos_y), mask=rounded_sheet)
    
    # Canva Shadow & Paste
    sh_canva, pad_c = create_shadow(rounded_canva.size, border_radius=24, offset=(0, 25), blur=50, color=(15, 23, 42, 40))
    canvas.paste(sh_canva, (pos_canva_x - pad_c, pos_y - pad_c), mask=sh_canva)
    canvas.paste(rounded_canva, (pos_canva_x, pos_y), mask=rounded_canva)
    
    # Floating Center Sync Badge
    badge_w, badge_h = 170, 58
    conn_x = pos_sheet_x + frame_sheet_w - (badge_w // 2) + 30
    conn_y = pos_y + 240
    
    conn_img = Image.new("RGBA", (badge_w, badge_h), (0, 0, 0, 0))
    conn_draw = ImageDraw.Draw(conn_img)
    conn_draw.rounded_rectangle([0, 0, badge_w, badge_h], radius=29, fill=(79, 70, 229, 255), outline=(255, 255, 255, 255), width=3)
    conn_draw.text((25, 14), "SYNC ->", font=fonts["pill"], fill=(255, 255, 255, 255))
    
    sh_badge, pad_b = create_shadow(conn_img.size, border_radius=29, offset=(0, 10), blur=20, color=(79, 70, 229, 80))
    canvas.paste(sh_badge, (conn_x - pad_b, conn_y - pad_b), mask=sh_badge)
    canvas.paste(conn_img, (conn_x, conn_y), mask=conn_img)
    
    # Footer
    footer_text = "Designed for Canva Apps Marketplace  •  Supports Google Sheets Live Sync & CSV Import"
    f_bbox = fonts["footer"].getbbox(footer_text)
    fw = f_bbox[2] - f_bbox[0]
    draw = ImageDraw.Draw(canvas)
    draw.text(((W - fw) // 2, 1700), footer_text, font=fonts["footer"], fill=(148, 163, 184, 255))
    
    output_path = "sheetflow_featured_1.png"
    canvas.convert("RGB").save(output_path, "PNG", quality=95)
    print(f"Saved: {output_path} ({os.path.getsize(output_path)} bytes)")


def generate_featured_2():
    print("Generating Featured Image 2 (2400 x 1800)...")
    W, H = 2400, 1800
    fonts = get_fonts()
    
    # 1. Background
    bg = build_gradient(W, H, (249, 250, 252), (238, 242, 248))
    canvas = bg.convert("RGBA")
    
    # Soft glows
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse([600, 400, 1800, 1400], fill=(99, 102, 241, 35)) # Indigo center glow
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    canvas = Image.alpha_composite(canvas, glow)
    draw = ImageDraw.Draw(canvas)
    
    # 2. Header
    badge_text = "DESIGN AUTOMATION"
    badge_bbox = fonts["badge"].getbbox(badge_text)
    bw = badge_bbox[2] - badge_bbox[0] + 60
    bh = 54
    bx = (W - bw) // 2
    by = 110
    
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=27, fill=(255, 255, 255, 240), outline=(203, 213, 225, 255), width=2)
    draw.ellipse([bx + 20, by + 18, bx + 36, by + 34], fill=(99, 102, 241, 255))
    draw.text((bx + 46, by + 10), badge_text, font=fonts["badge"], fill=(30, 41, 59, 255))
    
    title_text = "Update Menus, Catalogs, and Tags in Seconds"
    t_bbox = fonts["title"].getbbox(title_text)
    tw = t_bbox[2] - t_bbox[0]
    draw.text(((W - tw) // 2, 195), title_text, font=fonts["title"], fill=(15, 23, 42, 255))
    
    sub_text = "Replace canvas text instantly or populate multi-row datasets without manual retyping"
    s_bbox = fonts["sub"].getbbox(sub_text)
    sw = s_bbox[2] - s_bbox[0]
    draw.text(((W - sw) // 2, 295), sub_text, font=fonts["sub"], fill=(71, 85, 105, 255))
    
    # 3. Main Center Hero Card: Zoomed Canva Editor in Action
    img1_canva = Image.open("Screenshot 2026-10-24 224725.png") # (1650, 742)
    
    hero_w = 2100
    hero_img_scaled_h = int(img1_canva.height * ((hero_w - 24) / img1_canva.width))
    hero_img_resized = img1_canva.resize((hero_w - 24, hero_img_scaled_h), Image.Resampling.LANCZOS)
    
    hero_card_h = 70 + hero_img_scaled_h + 16
    hero_card = Image.new("RGBA", (hero_w, hero_card_h), (255, 255, 255, 255))
    h_draw = ImageDraw.Draw(hero_card)
    
    # Window Header
    h_draw.rectangle([0, 0, hero_w, 65], fill=(241, 245, 249, 255))
    h_draw.ellipse([24, 24, 40, 40], fill=(239, 68, 68, 255))
    h_draw.ellipse([48, 24, 64, 40], fill=(245, 158, 11, 255))
    h_draw.ellipse([72, 24, 88, 40], fill=(16, 185, 129, 255))
    h_draw.text((105, 18), "SheetFlow — 1-Click Replace & Smart Multi-Sync", font=fonts["pill"], fill=(51, 65, 85, 255))
    
    hero_card.paste(hero_img_resized, (12, 72))
    
    rounded_hero = round_corners(hero_card, radius=24, border_color=(203, 213, 225, 255), border_width=2)
    
    pos_hero_x = (W - hero_w) // 2
    pos_hero_y = 390
    
    sh_hero, pad_h = create_shadow(rounded_hero.size, border_radius=24, offset=(0, 25), blur=55, color=(15, 23, 42, 45))
    canvas.paste(sh_hero, (pos_hero_x - pad_h, pos_hero_y - pad_h), mask=sh_hero)
    canvas.paste(rounded_hero, (pos_hero_x, pos_hero_y), mask=rounded_hero)
    
    # 4. Three Feature Benefit Cards at Bottom
    features = [
        ("1-Click Value Replace", "Click 'Replace' on any field to instantly swap selected text on your canvas.", (16, 185, 129)),
        ("Smart Multi-Sync", "Batch-update matching design elements across an entire row in one step.", (99, 102, 241)),
        ("Complete Row Cards", "Insert ready-to-style layout cards containing all columns in a single click.", (245, 158, 11)),
    ]
    
    card_w = 660
    card_h = 180
    card_gap = 60
    total_cards_w = (card_w * 3) + (card_gap * 2)
    start_cx = (W - total_cards_w) // 2
    card_y = pos_hero_y + hero_card_h + 40
    
    for i, (f_title, f_desc, f_color) in enumerate(features):
        cx = start_cx + i * (card_w + card_gap)
        
        f_card = Image.new("RGBA", (card_w, card_h), (255, 255, 255, 250))
        fc_draw = ImageDraw.Draw(f_card)
        
        # Color bar on top
        fc_draw.rectangle([0, 0, card_w, 6], fill=(*f_color, 255))
        
        # Icon dot
        fc_draw.ellipse([24, 30, 48, 54], fill=(*f_color, 255))
        
        # Title & Desc
        fc_draw.text((60, 24), f_title, font=fonts["card_title"], fill=(15, 23, 42, 255))
        
        words = f_desc.split(" ")
        line1 = " ".join(words[:6])
        line2 = " ".join(words[6:])
        fc_draw.text((24, 76), line1, font=fonts["card_desc"], fill=(71, 85, 105, 255))
        fc_draw.text((24, 114), line2, font=fonts["card_desc"], fill=(71, 85, 105, 255))
        
        rounded_fc = round_corners(f_card, radius=18, border_color=(226, 232, 240, 255), border_width=1)
        sh_fc, pad_fc = create_shadow(rounded_fc.size, border_radius=18, offset=(0, 15), blur=30, color=(15, 23, 42, 25))
        
        canvas.paste(sh_fc, (cx - pad_fc, card_y - pad_fc), mask=sh_fc)
        canvas.paste(rounded_fc, (cx, card_y), mask=rounded_fc)
    
    # Footer
    footer_text = "Designed for Canva Apps Marketplace  •  Supports Google Sheets Live Sync & CSV Import"
    f_bbox = fonts["footer"].getbbox(footer_text)
    fw = f_bbox[2] - f_bbox[0]
    draw = ImageDraw.Draw(canvas)
    draw.text(((W - fw) // 2, 1715), footer_text, font=fonts["footer"], fill=(148, 163, 184, 255))
    
    output_path = "sheetflow_featured_2.png"
    canvas.convert("RGB").save(output_path, "PNG", quality=95)
    print(f"Saved: {output_path} ({os.path.getsize(output_path)} bytes)")

generate_featured_1()
generate_featured_2()
