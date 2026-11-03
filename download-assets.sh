#!/usr/bin/env bash
# Запустите из корня проекта (hustlify-shop). Ссылки Figma временные (~7 дней).
# Макет: Figma 1:5 (Frame 105). Часть 1 — герой → новости. Часть 2 (кейсы → контакты) качается только с флагом --p2.
# ВАЖНО: у logo / calc-glow-1 / calc-glow-2 / calc-glow-3 в новом макете другие файлы — перекачайте ВСЕ.
set -e
P="https://www.figma.com/api/mcp/asset/dbb1e742-4c8c-43f6-848e-a82c8fae0b18"
D="public/images/design"; mkdir -p "$D"
dl(){ curl -fsSL "$P/$1" -o "$D/$2" && echo "ok $2"; }

# ---------- герой ----------
dl e033b.svg hero-bg.svg
dl cb7ad.png hero-3d.png
dl 20918.png hero-avatars.png
dl 2f3b1.png hero-globe.png
dl 218ee.png hero-cube.png
dl a9c24.svg logo.svg
dl 9d9cb.svg icon-search.svg
dl 08e17.svg icon-cart.svg

# ---------- калькулятор ----------
dl 19d2f.svg calc-glow-1.svg
dl 9f18b.svg calc-glow-2.svg
dl 080e7.png calc-glow-3.png
dl 78b0a.svg slider-thumb.svg

# ---------- проекты (3D-иконки 001–004 + иконки кнопок) ----------
dl b0598.png proj-flux.png
dl 0bff6.png proj-vieto.png
dl b1b0d.png proj-cursor.png
dl 7479e.png proj-apex.png
dl 89207.svg proj-ic-tg.svg
dl 9e109.svg proj-ic-portfolio.svg
dl 0f827.svg proj-ic-site.svg

# ---------- новости (кнопка-лупа в плашке) ----------
dl 6381f.svg news-go-1.svg
dl c075e.svg news-ic-1.svg
dl 0d46a.svg news-go-2.svg
dl 1394b.svg news-ic-2.svg

# ---------- часть 2 (кейсы → контакты): только по флагу --p2, ссылки прежние и могли протухнуть ----------
if [ "$1" = "--p2" ]; then
  P="https://www.figma.com/api/mcp/asset/3c3bef1e-09aa-4d0f-9452-07aa7442688d"
  D="public/images/design/p2"; mkdir -p "$D"
  dl 8fbba.png case-pens.png
  dl 9e9a0.png case-icon.png
  dl 7c03e.png case-adv.png
  dl 81c11.png case-biz.png
  dl 11543.png case-std.png
  dl 61c91.png why-express.png
  dl 101a3.png why-support.png
  dl 12b73.png why-pay.png
  dl ca97a.png why-reviews.png
  dl 1d5a6.png why-exp.png
  dl 08037.png proc-1.png
  dl 540cc.png proc-2.png
  dl 2e832.png proc-3.png
  dl 56bc9.png proc-4.png
  dl 65dc6.png faq-books.png
  dl aefcd.png contact-support.png
fi
echo "Готово."