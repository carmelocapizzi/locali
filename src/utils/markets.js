// ─── Marchés près de l'utilisateur — universel (OSM) + enrichissement curé ─
// Socle mondial : amenity=marketplace d'OpenStreetMap, interrogé par rayon
// autour de la position. Enrichi par une liste vérifiée là où elle existe.
import { OVERPASS_ENDPOINTS, LOCAL_MARKETS } from '../data/constants';
import { haversine, formatDist } from './geo';
import { fetchOverpass } from './overpass';

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const CODE = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };

function hm(h, m) { return m === '00' ? +h + 'h' : +h + 'h' + m; }
function hmStr(t) { const [h, m] = t.split(':'); return hm(h, m); }

function nextDate(day, now) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (day - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}
function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function expandDays(part) {
  if (!part) return [];
  const order = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const out = [];
  for (const tok of part.split(',').map((t) => t.trim())) {
    const r = tok.match(/([A-Za-z]{2})\s*-\s*([A-Za-z]{2})/);
    if (r) {
      const a = order.indexOf(r[1]), b = order.indexOf(r[2]);
      if (a >= 0 && b >= 0) { let i = a, g = 0; while (g++ < 8) { out.push(CODE[order[i]]); if (i === b) break; i = (i + 1) % 7; } }
    } else if (CODE[tok] !== undefined) out.push(CODE[tok]);
  }
  return out;
}
// opening_hours OSM -> prochaine occurrence {date, dayName, time} ou null
function parseNextFromHours(oh, now) {
  if (!oh) return null;
  const slots = [];
  for (const rule of oh.split(';').map((r) => r.trim()).filter(Boolean)) {
    const m = rule.match(/^([A-Za-z,\-\s]*?)\s*([0-9:,\-\s]+)$/);
    if (!m) continue;
    const days = expandDays(m[1].trim());
    const tm = m[2].match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    const label = tm ? hm(tm[1], tm[2]) + '–' + hm(tm[3], tm[4]) : '';
    for (const d of days) slots.push({ day: d, label });
  }
  if (!slots.length) return null;
  let best = null;
  for (const sl of slots) {
    const dt = nextDate(sl.day, now);
    if (!best || dt < best.date) best = { date: dt, dayName: DAY_NAMES[sl.day], time: sl.label };
  }
  return best;
}

// Charge les marchés OSM autour de la position (fonctionne partout dans le monde)
export async function loadMarkets(lat, lon, radiusKm = 20) {
  const r = radiusKm * 1000;
  const q = `[out:json][timeout:20];(nwr["amenity"="marketplace"](around:${r},${lat},${lon}););out center 60;`;
  const body = 'data=' + encodeURIComponent(q);
  let data;
  try {
    data = await Promise.any(OVERPASS_ENDPOINTS.map((ep) => fetchOverpass(ep, body, 15000)));
  } catch (e) {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const el of data.elements) {
    const name = el.tags && el.tags.name;
    if (!name || seen.has(name)) continue;
    const la = el.lat != null ? el.lat : el.center && el.center.lat;
    const lo = el.lon != null ? el.lon : el.center && el.center.lon;
    if (la == null || lo == null) continue;
    seen.add(name);
    out.push({
      id: 'osm-' + el.type + '/' + el.id, name, lat: la, lon: lo,
      hours: el.tags.opening_hours || null,
      addr: el.tags['addr:city'] || el.tags['addr:street'] || '',
    });
  }
  return out;
}

// Fusionne marchés vérifiés (curés) + marchés OSM, triés par prochaine date
export function buildMarkets(lat, lon, osmMarkets = [], radiusKm = 30, now = new Date()) {
  const out = [];

  // 1) Marchés vérifiés (jours/heures exacts) — filtrés par distance (donc régionaux)
  for (const m of LOCAL_MARKETS) {
    const dist = lat != null ? haversine(lat, lon, m.lat, m.lon) : null;
    if (dist != null && dist > radiusKm * 1000) continue;
    const date = nextDate(m.day, now);
    out.push({
      id: m.id, name: m.name, commune: m.commune, place: m.place, lat: m.lat, lon: m.lon,
      dist, distStr: dist != null ? formatDist(dist) : '',
      date, dayName: DAY_NAMES[m.day], time: hmStr(m.start) + '–' + hmStr(m.end),
      today: sameDay(date, now), curated: true,
    });
  }

  // 2) Marchés OSM (universels) — on saute ceux déjà couverts par un marché vérifié proche
  for (const s of osmMarkets) {
    if (out.some((m) => haversine(m.lat, m.lon, s.lat, s.lon) < 1500)) continue;
    const dist = lat != null ? haversine(lat, lon, s.lat, s.lon) : null;
    if (dist != null && dist > radiusKm * 1000) continue; // limité au rayon choisi
    const next = parseNextFromHours(s.hours, now);
    out.push({
      id: s.id, name: s.name, commune: '', place: s.addr || '', lat: s.lat, lon: s.lon,
      dist, distStr: dist != null ? formatDist(dist) : '',
      date: next ? next.date : null,
      dayName: next ? next.dayName : 'Jour de marché',
      time: next ? next.time : '',
      today: next ? sameDay(next.date, now) : false, curated: false,
    });
  }

  out.sort((a, b) => {
    const da = a.date ? a.date.getTime() : Infinity;
    const db = b.date ? b.date.getTime() : Infinity;
    if (da !== db) return da - db;
    return (a.dist || Infinity) - (b.dist || Infinity);
  });
  return out;
}
