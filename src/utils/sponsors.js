// ─── Sponsors locaux : commerces qui financent la livraison gratuite ─
// Un commerce (qui livre ou non : resto, garage, agence, artisan…) peut sponsoriser
// les livraisons de son quartier. En échange : visibilité (« Livraison offerte par X »)
// et badge « Sponsor local ». Aucun coût pour le client, aucune hausse de prix.
const KEY = 'locali.sponsors';

export function loadSponsors() {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; } catch (e) { return []; }
}
export function saveSponsors(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
}
export function upsertSponsor(s) {
  const list = loadSponsors();
  const i = list.findIndex((x) => x.id === s.id);
  if (i >= 0) list[i] = { ...list[i], ...s };
  else list.push(s);
  saveSponsors(list);
}
export function removeSponsor(id) {
  saveSponsors(loadSponsors().filter((s) => s.id !== id));
}
export function activeSponsors() {
  return loadSponsors().filter((s) => s.active !== false);
}
// Sponsor mis en avant (rotation horaire pour partager la visibilité équitablement)
export function pickSponsor() {
  const a = activeSponsors();
  if (!a.length) return null;
  return a[Math.floor(Date.now() / 3600000) % a.length];
}
