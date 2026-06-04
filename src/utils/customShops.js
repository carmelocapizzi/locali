// ─── Commerces ajoutés manuellement (absents d'OpenStreetMap) ─
const CKEY = 'locali.customShops';

export function loadCustomShops() {
  try { const r = localStorage.getItem(CKEY); return r ? JSON.parse(r) : []; } catch (e) { return []; }
}
export function addCustomShop(shop) {
  const list = loadCustomShops();
  list.push(shop);
  try { localStorage.setItem(CKEY, JSON.stringify(list)); } catch (e) {}
  return shop;
}
