#!/usr/bin/env bash
# Запустите из корня проекта (hustlify-shop). Ссылки Figma временные (~7 дней).
# Часть 1 (node 413:2) и часть 2 (node 424:142) имеют разные префиксы.
set -e
D="public/images/design"; mkdir -p "$D"

# ---------- ЧАСТЬ 1 ----------
P1="https://www.figma.com/api/mcp/asset/e7e0506f-6c0f-45f0-b04b-879a8a50c124"
dl1(){ curl -fsSL "$P1/$1" -o "$D/$2" && echo "ok $2"; }
dl1 e033b.svg hero-bg.svg
dl1 cb7ad.png hero-3d.png
dl1 20918.png hero-avatars.png
dl1 2f3b1.png hero-globe.png
dl1 218ee.png hero-cube.png
dl1 b2cc9.svg logo.svg
dl1 9d9cb.svg icon-search.svg
dl1 08e17.svg icon-cart.svg
dl1 f1acb.svg calc-glow-1.svg
dl1 5def3.svg calc-glow-2.svg
dl1 1f362.png calc-glow-3.png
dl1 78b0a.svg slider-thumb.svg

# ---------- ЧАСТЬ 2 ----------
P2="https://www.figma.com/api/mcp/asset/6fa5308c-eb13-4502-a232-6c7fcf167a34"
dl2(){ curl -fsSL "$P2/$1" -o "$D/$2" && echo "ok $2"; }
dl2 8fbba.png case-pens.png        # кейс «Премиум»: 3D-декор
dl2 9e9a0.png case-icon.png        # кейс «Премиум»: иконка рядом с заголовком
dl2 7c03e.png case-deco-1.png      # правая карточка 1
dl2 81c11.png case-deco-2.png      # правая карточка 2
dl2 11543.png case-deco-3.png      # правая карточка 3
dl2 a9150.png team-photo.png       # фото Тимура
dl2 2a281.svg team-dot.svg
dl2 25ba0.png process-1.png
dl2 5802d.png process-2.png
dl2 8f5aa.png process-3.png
dl2 3cc4e.png process-4.png
dl2 e044d.png faq-3d.png
dl2 0580a.svg faq-line.svg
dl2 aefcd.png contacts-support.png
echo "Готово. Фото отзывов (Frame_72.png … Frame_78.png) положите в public/images/reviews/"