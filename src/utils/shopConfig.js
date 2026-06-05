// ─── Réglages de livraison par commerce (édités par le commerçant) ─
// Clé par shopId → { freeThreshold, deliveryMode, courierPerks: [{id,label,detail}] }
// Le commerçant écrit la config de SON commerce ; clients et livreurs la lisent.
const KEY = 'locali.shopConfig';

function loadAll() {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : {}; } catch (e) { return {}; }
}
function saveAll(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) {}
}

export function getShopConfig(shopId) {
  if (!shopId) return null;
  return loadAll()[shopId] || null;
}
export function setShopConfig(shopId, cfg) {
  if (!shopId) return;
  const map = loadAll();
  map[shopId] = { ...(map[shopId] || {}), ...cfg };
  saveAll(map);
}
// Tous les avantages livreurs proposés, avec le nom du commerce
export function allCourierPerks() {
  const map = loadAll();
  const out = [];
  for (const id of Object.keys(map)) {
    const c = map[id];
    if (c && Array.isArray(c.courierPerks)) {
      for (const p of c.courierPerks) out.push({ ...p, shopId: id, shopName: c.shopName || '' });
    }
  }
  return out;
}
