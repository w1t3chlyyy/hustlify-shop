#!/usr/bin/env bash
# Запустить из корня проекта ДО update-mobile.js. Ссылки Figma живут ~7 дней.
# Остальные картинки мобильного хиро (3D-фото, аватарки, глобус, лого, иконки) уже лежат в public/images/design/.
set -e
P="https://www.figma.com/api/mcp/asset/07c09612-6d7a-4457-b157-3670eca913e3"
D="public/images/design"; mkdir -p "$D"
curl -fsSL "$P/04415.svg" -o "$D/hero-bg-m.svg" && echo "ok hero-bg-m.svg"
curl -fsSL "$P/5cb46.png" -o "$D/hero-cube-m.png" && echo "ok hero-cube-m.png"