#!/usr/bin/env bash
# Запустите из корня проекта (hustlify-shop). Ссылки Figma временные (~7 дней).
set -e
P="https://www.figma.com/api/mcp/asset/998c9f3b-e2d2-4da7-8cc9-b849ae7120a1"
D="public/images/design"; mkdir -p "$D"
dl(){ curl -fsSL "$P/$1" -o "$D/$2" && echo "ok $2"; }
dl 3edfa.svg hero-bg.svg
dl cb7ad.png hero-3d.png
dl 20918.png hero-avatars.png
dl 2f3b1.png hero-globe.png
dl 218ee.png hero-cube.png
dl b2cc9.svg logo.svg
dl 1d8b1.svg icon-search.svg
dl 86bf6.svg icon-cart.svg
dl f1acb.svg calc-glow-1.svg
dl 5def3.svg calc-glow-2.svg
dl df791.png calc-glow-3.png
dl 78b0a.svg slider-thumb.svg
