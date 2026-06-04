// ─── Événements locaux publiés par les commerçants ──────
// Stockés en localStorage (prototype). Dans une vraie app : backend partagé,
// éventuellement complété par une source ouverte type OpenAgenda.
import { haversine, formatDist } from './geo';

const EKEY = 'locali.events';

export function loadEvents() {
  try { const r = localStorage.getItem(EKEY); return r ? JSON.parse(r) : []; } catch (e) { return []; }
}
export function saveEvents(list) {
  try { localStorage.setItem(EKEY, JSON.stringify(list)); } catch (e) {}
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Événements à venir, dans le rayon, triés par date
export function buildEvents(lat, lon, radiusKm = 30, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return loadEvents()
    .map((e) => ({ ...e, dateObj: e.date ? new Date(e.date + 'T00:00:00') : null }))
    .filter((e) => e.dateObj && e.dateObj >= start)
    .map((e) => {
      const dist = lat != null && e.lat != null ? haversine(lat, lon, e.lat, e.lon) : null;
      return { ...e, dist, distStr: dist != null ? formatDist(dist) : '', today: sameDay(e.dateObj, now) };
    })
    .filter((e) => e.dist == null || e.dist <= radiusKm * 1000)
    .sort((a, b) => a.dateObj - b.dateObj);
}
