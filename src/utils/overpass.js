// ─── Récupération des commerces réels via Overpass / OSM ─
import { DISCOVERY_RADIUS_M, OVERPASS_ENDPOINTS, TYPE_META } from '../data/constants';
import { haversine, formatDist } from './geo';

export function getMeta(type) {
  return TYPE_META[type] || TYPE_META.other;
}

export function buildOverpassQuery(lat, lon, radius) {
  const types = ['bakery', 'pastry', 'butcher', 'farm', 'organic', 'cheese', 'dairy', 'greengrocer', 'supermarket', 'convenience', 'deli'];
  const parts = types
    .map(
      (t) =>
        `node["shop"="${t}"](around:${radius},${lat},${lon});` +
        `way["shop"="${t}"](around:${radius},${lat},${lon});`
    )
    .join('');
  const market = `node["amenity"="marketplace"](around:${radius},${lat},${lon});way["amenity"="marketplace"](around:${radius},${lat},${lon});`;
  return `[out:json][timeout:25];(${parts}${market});out center 200;`;
}

export function determineType(tags) {
  const s = tags.shop || '';
  const a = tags.amenity || '';
  if (s === 'bakery' || s === 'pastry') return 'bakery';
  if (s === 'butcher') return 'butcher';
  if (s === 'farm' || s === 'organic') return 'farm';
  if (s === 'cheese' || s === 'dairy') return 'cheese';
  if (s === 'greengrocer') return 'greengrocer';
  if (s === 'supermarket' || s === 'wholesale') return 'supermarket';
  if (s === 'convenience') return 'convenience';
  if (s === 'deli' || s === 'delicatessen') return 'deli';
  if (a === 'marketplace') return 'marketplace';
  return 'other';
}

function processShops(elements, lat, lon) {
  const seen = new Set();
  const out = [];
  for (const el of elements) {
    const name = el.tags && el.tags.name;
    if (!name || seen.has(name)) continue;
    const elLat = el.lat != null ? el.lat : el.center && el.center.lat;
    const elLon = el.lon != null ? el.lon : el.center && el.center.lon;
    if (elLat == null || elLon == null) continue;
    const dist = haversine(lat, lon, elLat, elLon);
    if (dist > DISCOVERY_RADIUS_M + 500) continue;
    seen.add(name);
    const t = el.tags;
    out.push({
      id: el.type + '/' + el.id,
      name,
      lat: elLat,
      lon: elLon,
      type: determineType(t),
      tags: t,
      dist,
      distStr: formatDist(dist),
      hours: t.opening_hours || null,
      addr: t['addr:street']
        ? t['addr:street'] +
          (t['addr:housenumber'] ? ' ' + t['addr:housenumber'] : '') +
          (t['addr:city'] ? ', ' + t['addr:city'] : '')
        : null,
      phone: t.phone || t['contact:phone'] || null,
      website: t.website || t['contact:website'] || null,
    });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

// Essaie plusieurs serveurs Overpass jusqu'à en obtenir un qui répond
export async function loadShops(lat, lon) {
  const query = buildOverpassQuery(lat, lon, DISCOVERY_RADIUS_M);
  let data = null;
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(query) });
      if (!res.ok) continue;
      const json = await res.json();
      if (json && json.elements) { data = json; break; }
    } catch (e) {
      /* on essaie l'endpoint suivant */
    }
  }
  if (!data) throw new Error('overpass-unavailable');
  return processShops(data.elements, lat, lon);
}
