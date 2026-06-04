// ─── Source d'événements ouverte : OpenAgenda ───────────
// Intégration configurable. Pour l'activer, renseignez dans un fichier .env :
//   VITE_OPENAGENDA_KEY=<votre clé publique>
//   VITE_OPENAGENDA_AGENDA=<UID de l'agenda à interroger>
// (clé gratuite sur https://developers.openagenda.com). Sans clé, no-op.
import { haversine, formatDist } from './geo';

const KEY = import.meta.env.VITE_OPENAGENDA_KEY;
const AGENDA = import.meta.env.VITE_OPENAGENDA_AGENDA;

export const OPENAGENDA_ENABLED = !!(KEY && AGENDA);

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function bbox(lat, lon, km) {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { neLat: lat + dLat, neLon: lon + dLon, swLat: lat - dLat, swLon: lon - dLon };
}

// Récupère les événements OpenAgenda à venir dans un rayon autour de l'utilisateur.
// Renvoie des objets au même format que les événements commerçants.
export async function fetchOpenAgenda(lat, lon, radiusKm = 30) {
  if (!OPENAGENDA_ENABLED || lat == null) return [];
  const b = bbox(lat, lon, radiusKm);
  const p = new URLSearchParams();
  p.set('key', KEY);
  p.set('size', '40');
  p.set('detailed', '1');
  p.set('timings[gte]', new Date().toISOString());
  p.set('geo[northEast][lat]', b.neLat);
  p.set('geo[northEast][lng]', b.neLon);
  p.set('geo[southWest][lat]', b.swLat);
  p.set('geo[southWest][lng]', b.swLon);
  const url = `https://api.openagenda.com/v2/agendas/${AGENDA}/events?${p.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return (data.events || [])
      .map((ev) => {
        const t = ev.nextTiming || (ev.timings && ev.timings[0]) || {};
        const begin = t.begin ? new Date(t.begin) : null;
        const loc = ev.location || {};
        const title = (ev.title && (ev.title.fr || ev.title.en || Object.values(ev.title)[0])) || 'Événement';
        const dist = loc.latitude != null ? haversine(lat, lon, loc.latitude, loc.longitude) : null;
        return {
          id: 'oa-' + ev.uid,
          title,
          type: 'Événement',
          date: begin ? begin.toISOString().slice(0, 10) : null,
          dateObj: begin,
          place: loc.name || loc.city || '',
          lat: loc.latitude, lon: loc.longitude,
          dist, distStr: dist != null ? formatDist(dist) : '',
          today: sameDay(begin, new Date()),
          source: 'openagenda',
        };
      })
      .filter((e) => e.dateObj && e.dateObj >= start);
  } catch (e) {
    return []; // réseau/CORS indisponible → on ignore proprement
  }
}
