// ─── Participation des commerces à Locali ───────────────
// status par commerce : 'subscribed' | 'trial' | 'none'
// (dans une vraie app : fourni par le backend ; ici : le commerçant inscrit
//  sur l'appareil désigne SON commerce, coloré selon son abonnement/essai.)

const PKEY = 'locali.participants';

export function loadParticipants() {
  try { const r = localStorage.getItem(PKEY); return r ? JSON.parse(r) : {}; } catch (e) { return {}; }
}
export function saveParticipants(map) {
  try { localStorage.setItem(PKEY, JSON.stringify(map)); } catch (e) {}
}
export function setParticipation(shopId, status) {
  if (!shopId) return;
  const m = loadParticipants();
  if (!status || status === 'none') delete m[shopId];
  else m[shopId] = status;
  saveParticipants(m);
}
export function participationOf(shopId, map) {
  const m = map || loadParticipants();
  return m[shopId] || 'none';
}

// Couleur d'un marqueur selon la participation
export function participationColor(status, fallback) {
  if (status === 'subscribed') return fallback || '#2a4226'; // couleur vive du type
  if (status === 'trial') return '#2980b9';                  // bleuté = essai
  return '#b9b3a6';                                          // gris = non participant
}
