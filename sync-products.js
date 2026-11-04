/* Выгружает каталог из Supabase в data/products.json (резервный файл-копия).
   Позиции категории «Верификации» в файл НЕ попадают.
   Запуск из корня проекта:  node sync-products.js */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env'); process.exit(1);
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

(async () => {
  const { data, error } = await sb.from('products').select('*').order('section').order('category').order('id');
  if (error) { console.error(error.message); process.exit(1); }
  const items = data
    .filter(r => r.category !== 'Верификации')
    .map(r => ({
      id: r.id, name: r.name, section: r.section || 'catalog',
      cat: r.category || '', category: r.category || '',
      desc: r.description || '', price: Number(r.price) || 0, old: Number(r.old_price) || 0,
      icon: r.icon || '', img: r.img || '', hit: !!r.hit, hidden: !!r.hidden, deleted: !!r.deleted
    }));
  const file = path.join(process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data'), 'products.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(items, null, 2));
  console.log('OK  записано позиций:', items.length, '→', file);
})();
