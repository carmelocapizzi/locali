// ─── Cycle de vie des commandes (partagé entre les 3 rôles) ─
// Stocké en localStorage (prototype mono-appareil). Dans une vraie app : backend.
// Flux : pending (client) → accepted (commerçant valide) → delivering (livreur prend)
//        → delivered (livreur confirme la réception par le client).
import { haversine, formatDist } from './geo';

const OKEY = 'locali.orders';

export function loadOrders() {
  try { const r = localStorage.getItem(OKEY); return r ? JSON.parse(r) : []; } catch (e) { return []; }
}
export function saveOrders(list) {
  try { localStorage.setItem(OKEY, JSON.stringify(list)); } catch (e) {}
}
export function addOrder(o) {
  const list = loadOrders();
  const order = {
    id: 'ord-' + Date.now(),
    ref: '#LCL-' + (2847 + list.length),
    status: 'pending',
    createdAt: Date.now(),
    acceptedAt: null, deliveringAt: null, deliveredAt: null, courier: null,
    ...o,
  };
  list.push(order);
  saveOrders(list);
  return order;
}
export function updateOrder(id, patch) {
  const list = loadOrders().map((o) => (o.id === id ? { ...o, ...patch } : o));
  saveOrders(list);
  return list;
}

export const ORDER_STEPS = ['Envoyée', 'Validée', 'Livraison', 'Livrée'];
const STEP = { pending: 0, accepted: 1, delivering: 2, delivered: 3 };
export function statusStep(s) { return STEP[s] != null ? STEP[s] : 0; }

const PILL = {
  pending:    { c: 's-prep',  t: 'À valider' },
  accepted:   { c: 's-ready', t: 'Validée' },
  delivering: { c: 's-way',   t: 'En livraison' },
  delivered:  { c: 's-done',  t: 'Livrée ✓' },
};
export function statusPill(s) { return PILL[s] || PILL.pending; }

export function agoStr(ts) {
  if (!ts) return '';
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return 'il y a ' + m + ' min';
  return 'il y a ' + Math.floor(m / 60) + ' h';
}
export function durMin(a, b) {
  if (!a || !b) return null;
  return Math.max(1, Math.round((b - a) / 60000));
}
export function isToday(ts) {
  if (!ts) return false;
  const d = new Date(ts), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
export function itemsLabel(items) {
  return (items || []).map((it) => `${it.qty}× ${it.n}`).join(' · ');
}

export { haversine, formatDist };
