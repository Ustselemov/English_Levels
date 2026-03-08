# Levels Layer Map

Folder: D:\VibeCoding\Levels
Canvas: 1080x1080

Layer order: back to front

01. 01_white_bg.png
02. 03_character_shadow.png
03. 04_character_bg.png
04. 06_mouth\
05. 05_eyes\
06. 02_headphones\
07. 07_books\
08. 08_level_panel.png
09. 09_level_panel_elements\

Inside each category folder:
- element_frames\
  Always fully visible.
- number_frames\
  Always fully visible.
  Draw order: rounded_rect_2, then rounded_rect_1.
- numbers\
  Shows plate_1 ... plate_N based on the mapped slider.
  Shows one matching number_N_of_10.png on top.

Current app mapping:
- listening -> headphones
- pronunciation -> mouth
- vocabulary -> books
- grammar -> grammar slider
- fluency -> eyes
