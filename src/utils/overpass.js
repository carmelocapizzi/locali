// ─── Récupération des commerces réels via Overpass / OSM ─
import { DISCOVERY_RADIUS_M, OVERPASS_ENDPOINTS, TYPE_META } from '../data/constants';
import { haversine, formatDist } from './geo';

export function getMeta(type) {
  return TYPE_META[type] || TYPE_META.other;
}

export function buildOverpassQuery(lat, lon, radius) {
  // Requête compacte : nwr (node/way/relation) + regex sur les types → plus rapide à traiter
  const types = 'bakery|pastry|butcher|farm|organic|cheese|dairy|greengrocer|supermarket|convenience|deli';
  return (
    `[out:json][timeout:20];(` +
    `nwr["shop"~"^(${types})$"](around:${radius},${lat},${lon});` +
    `nwr["amenity"="marketplace"](around:${radius},${lat},${lon});` +
    `);out center 300;`
  );
}

// Cache local par zone (clé arrondie ~1 km) → réouverture instantanée
const SHOP_TTL = 24 * 3600 * 1000;
function shopCacheKey(lat, lon) { return 'locali.shops.' + lat.toFixed(2) + '_' + lon.toFixed(2); }
function readShopCache(lat, lon) {
  try { const r = localStorage.getItem(shopCacheKey(lat, lon)); if (!r) return null; const o = JSON.parse(r); return (Date.now() - o.ts < SHOP_TTL && Array.isArray(o.shops)) ? o.shops : null; } catch (e) { return null; }
}
function writeShopCache(lat, lon, shops) {
  try { localStorage.setItem(shopCacheKey(lat, lon), JSON.stringify({ ts: Date.now(), shops })); } catch (e) {}
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

// Un seul endpoint, avec timeout dur (AbortController)
export function fetchOverpass(ep, body, ms = 22000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(ep, { method: 'POST', body, signal: ctrl.signal })
    .then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .then((d) => { if (!d || !d.elements) throw new Error('no elements'); return d; })
    .finally(() => clearTimeout(t));
}

// Interroge TOUS les miroirs Overpass EN PARALLÈLE → le plus rapide gagne.
// Zone déjà chargée récemment → renvoi instantané depuis le cache.
export async function loadShops(lat, lon) {
  const cached = readShopCache(lat, lon);
  if (cached) return cached;
  const body = 'data=' + encodeURIComponent(buildOverpassQuery(lat, lon, DISCOVERY_RADIUS_M));
  let data;
  try {
    data = await Promise.any(OVERPASS_ENDPOINTS.map((ep) => fetchOverpass(ep, body)));
  } catch (e) {
    throw new Error('overpass-unavailable');
  }
  const shops = processShops(data.elements, lat, lon);
  writeShopCache(lat, lon, shops);
  return shops;
}
