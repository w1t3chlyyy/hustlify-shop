#!/usr/bin/env bash
# Запустите из корня проекта (hustlify-shop). Ссылки Figma временные (~7 дней).
# ВАЖНО: перекачайте ВСЕ файлы — у hero-bg и иконок поиска/корзины в актуальном макете другие id.
set -e
P="https://www.figma.com/api/mcp/asset/3649f205-2925-4f7c-b864-070f14d748f5"
D="public/images/design"; mkdir -p "$D"
dl(){ curl -fsSL "$P/$1" -o "$D/$2" && echo "ok $2"; }
dl e033b.svg hero-bg.svg
dl cb7ad.png hero-3d.png
dl 20918.png hero-avatars.png
dl 2f3b1.png hero-globe.png
dl 218ee.png hero-cube.png
dl b2cc9.svg logo.svg
dl 9d9cb.svg icon-search.svg
dl 08e17.svg icon-cart.svg
dl f1acb.svg calc-glow-1.svg
dl 5def3.svg calc-glow-2.svg
dl df791.png calc-glow-3.png
dl 78b0a.svg slider-thumb.svg