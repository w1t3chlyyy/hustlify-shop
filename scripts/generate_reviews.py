import os

REVIEWS = [
    {
        "id": "1",
        "brand": "Nexa",
        "circleBg": "#A2FF00",
        "glow": "rgba(162, 255, 0, 0.65)",
        "textColor": "#FFFFFF",
        "iconColor": "#000000",
        "text": "Заказал у ребят криптообменник USDT в Telegram. Сделали дизайн, написали бота, всё работает как часы. Обмен за секунды — клиенты довольны!",
        "icon": '''
          <!-- Nexa origami bird -->
          <g transform="translate(170, 92) scale(0.95)">
            <!-- Head & beak -->
            <path d="M-8,-16 C-2,-26 12,-26 26,-22 C28,-18 20,-12 12,-6 C8,-2 4,4 0,10 C-4,14 -12,20 -20,24 C-16,14 -10,6 -6,0 C-10,-4 -16,-8 -24,-10 C-14,-14 -4,-15 -8,-16 Z" fill="#000000"/>
            <path d="M-2,-14 L24,-22 L-14,18 L-2,-14 Z" fill="#000000"/>
            <!-- Head curve -->
            <path d="M-2,-18 C6,-24 16,-24 24,-21 C12,-16 4,-12 0,-8 Z" fill="#000000"/>
          </g>
        '''
    },
    {
        "id": "2",
        "brand": "Aura",
        "circleBg": "#1554F6",
        "glow": "rgba(21, 84, 246, 0.65)",
        "textColor": "#FFFFFF",
        "iconColor": "#FFFFFF",
        "text": "Музыкальный сайт сделали под ключ. Дизайн классный, плеер удобный, админка простая. Всё, что просил — сделали. Спасибо!",
        "icon": '''
          <!-- Aura dynamic stroke wave -->
          <g transform="translate(170, 92)">
            <path d="M-22,12 C-18,0 -12,-22 -4,-22 C4,-22 0,6 6,6 C12,6 14,-10 18,-10 C21,-10 23,2 25,6" 
                  fill="none" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        '''
    },
    {
        "id": "3",
        "brand": "Geshtalt",
        "circleBg": "#A000FF",
        "glow": "rgba(160, 0, 255, 0.65)",
        "textColor": "#FFFFFF",
        "iconColor": "#FFFFFF",
        "text": "Мутили с ребятами сайт под лидогенерацию. Всё четко, без переплат. Лиды приходят — я доволен.",
        "icon": '''
          <!-- Geshtalt magnet G -->
          <g transform="translate(170, 92)">
            <path d="M12,-12 C6,-18 -4,-18 -12,-12 C-20,-6 -20,6 -12,12 C-4,18 8,18 14,12 C18,8 18,1 18,0 L2,0" 
                  fill="none" stroke="#FFFFFF" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        '''
    },
    {
        "id": "4",
        "brand": "Lumora",
        "circleBg": "#FF9400",
        "glow": "rgba(255, 148, 0, 0.65)",
        "textColor": "#FFFFFF",
        "iconColor": "#FFFFFF",
        "text": "Обновили сайт турагентства — конверсия выросла. Заявки сыпятся, туроператоры довольны. Наконец-то!",
        "icon": '''
          <!-- Lumora TC ligature -->
          <g transform="translate(170, 92)">
            <!-- Top bar -->
            <rect x="-14" y="-18" width="28" height="7.5" rx="3.75" fill="#FFFFFF"/>
            <!-- Stem and hook -->
            <path d="M-5,-14 L-5,4 C-5,13 3,18 13,16" 
                  fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
            <!-- Middle notch -->
            <path d="M-14,-3 L4,-3" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
          </g>
        '''
    },
    {
        "id": "5",
        "brand": "Verde",
        "circleBg": "#1BB753",
        "glow": "rgba(27, 183, 83, 0.65)",
        "textColor": "#FFFFFF",
        "iconColor": "#FFFFFF",
        "text": "Собрали криптокошелек четко по моему тз. Вышло даже лучше чем мы думали. Приятно удивили, спасибо.",
        "icon": '''
          <!-- Verde folded geometry -->
          <g transform="translate(170, 92)">
            <rect x="-20" y="-18" width="18" height="15" rx="2" fill="#FFFFFF"/>
            <polygon points="-4,-18 20,-18 -10,20 -10,4" fill="#FFFFFF"/>
          </g>
        '''
    },
    {
        "id": "6",
        "brand": "SkyElite",
        "circleBg": "#262E3B",
        "glow": "rgba(58, 75, 96, 0.65)",
        "textColor": "#FFFFFF",
        "iconColor": "#FFFFFF",
        "text": "Теперь у меня есть AI-сервис для путешественников. Нейросеть анализирует сотни вариантов и выдаёт лучшие предложения. Пользователи возвращаются снова.",
        "icon": '''
          <!-- SkyElite supersonic wing -->
          <g transform="translate(170, 92)">
            <path d="M-24,-14 C-10,-18 10,-18 24,-14 C10,-11 -10,-11 -24,-14 Z" fill="#FFFFFF"/>
            <path d="M-22,-2 L16,-2 C5,10 -11,14 -14,14 C-7,7 -12,2 -22,-2 Z" fill="#FFFFFF"/>
            <path d="M-18,8 L10,6 C-1,14 -12,18 -14,18 C-9,12 -12,9 -18,8 Z" fill="#FFFFFF"/>
          </g>
        '''
    },
    {
        "id": "7",
        "brand": "Pictor",
        "circleBg": "#1C1C20",
        "glow": "rgba(255, 255, 255, 0.25)",
        "textColor": "#FFFFFF",
        "iconColor": "#FFFFFF",
        "text": "Сайт Pictor — это наше лицо. Сделали информационно, без перегруза, но со вкусом. Всё работает, всё открывается",
        "icon": '''
          <!-- Pictor crescent sparkle -->
          <g transform="translate(170, 92)">
            <path d="M7,-13 C-8,-18 -18,-2 -10,12 C-4,18 2,16 6,10 C1,10 -4,6 -4,0 C-4,-8 4,-10 7,-13 Z" fill="#FFFFFF"/>
            <circle cx="-5" cy="18" r="3.5" fill="#FFFFFF"/>
            <!-- 4-point star -->
            <path d="M12,-18 L14,-13 L19,-11 L14,-9 L12,-4 L10,-9 L5,-11 L10,-13 Z" fill="#FFFFFF"/>
          </g>
        '''
    }
]

os.makedirs('public/images/reviews', exist_ok=True)

def wrap_text(text, limit=25):
    words = text.split()
    lines = []
    cur = []
    cur_len = 0
    for w in words:
        if cur_len + len(w) + (1 if cur else 0) <= limit:
            cur.append(w)
            cur_len += len(w) + (1 if len(cur) > 1 else 0)
        else:
            lines.append(" ".join(cur))
            cur = [w]
            cur_len = len(w)
    if cur:
        lines.append(" ".join(cur))
    return lines

for item in REVIEWS:
    wrapped = wrap_text(item["text"], limit=26)
    tspan_svg = ""
    y_start = 236
    line_h = 22
    for i, l in enumerate(wrapped):
        tspan_svg += f'<tspan x="42" y="{y_start + i * line_h}">{l}</tspan>\n'

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 425" width="340" height="425">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600&amp;family=Unbounded:wght@800&amp;display=swap');
      .brand-title {{
        font-family: 'Unbounded', system-ui, -apple-system, sans-serif;
        font-weight: 800;
        font-size: 32px;
        fill: #FFFFFF;
        letter-spacing: -0.02em;
        text-anchor: middle;
      }}
      .review-body {{
        font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
        font-weight: 500;
        font-size: 13.5px;
        line-height: 1.5;
        fill: rgba(255, 255, 255, 0.94);
      }}
    </style>
    <radialGradient id="halo_{item['id']}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="{item['circleBg']}" stop-opacity="0.8"/>
      <stop offset="45%" stop-color="{item['circleBg']}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="{item['circleBg']}" stop-opacity="0"/>
    </radialGradient>
    <filter id="card_shadow_{item['id']}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.7"/>
    </filter>
  </defs>

  <!-- Background canvas -->
  <rect width="340" height="425" rx="26" fill="#18181A"/>

  <!-- Glowing atmospheric halo -->
  <circle cx="170" cy="92" r="85" fill="url(#halo_{item['id']})"/>

  <!-- Main Card container -->
  <rect x="24" y="122" width="292" height="280" rx="26" fill="#1F1F22" stroke="rgba(255,255,255,0.18)" stroke-width="1.2" filter="url(#card_shadow_{item['id']})"/>

  <!-- Avatar circular badge -->
  <circle cx="170" cy="92" r="50" fill="{item['circleBg']}"/>

  <!-- Icon inside badge -->
  {item['icon']}

  <!-- Brand Heading -->
  <text x="170" y="186" class="brand-title">{item['brand']}</text>

  <!-- Review comment body -->
  <text class="review-body">
    {tspan_svg}
  </text>
</svg>'''

    with open(f"public/images/reviews/{item['id']}.svg", "w", encoding="utf-8") as f:
        f.write(svg)

print("Updated 7 review cards SVG with pixel-perfect Figma reproduction!")
