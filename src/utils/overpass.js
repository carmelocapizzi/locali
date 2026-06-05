// ─── Récupération des commerces réels via Overpass / OSM ─
import { DISCOVERY_RADIUS_M, OVERPASS_ENDPOINTS, TYPE_META } from '../data/constants';
import { haversine, formatDist } from './geo';

export function getMeta(type) {
  return TYPE_META[type] || TYPE_META.other;
}

// ── Commerces embarqués (extrait OSM régional) ──────────────
// Affichage instantané, précis et hors-ligne : aucune requête réseau bloquante
// pour la zone couverte. Overpass n'est sollicité qu'en dehors de cette zone.
const BUNDLED_BBOX = { s: 49.45, w: 2.55, n: 51.55, e: 6.45 }; // toute la Belgique (extrait OSM national)
export function inBundledBox(lat, lon) {
  return lat >= BUNDLED_BBOX.s && lat <= BUNDLED_BBOX.n && lon >= BUNDLED_BBOX.w && lon <= BUNDLED_BBOX.e;
}

let bundledPromise = null;
function loadBundled() {
  if (!bundledPromise) {
    const url = (import.meta.env.BASE_URL || '/') + 'shops-be.json';
    bundledPromise = fetch(url)
      .then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then((rows) => rows.map(([id, type, name, lat, lon, hours, addr, phone, website]) => ({
        id, type, name, lat, lon, hours: hours || null, addr: addr || null, phone: phone || null, website: website || null, tags: {},
      })))
      .catch((e) => { bundledPromise = null; throw e; });
  }
  return bundledPromise;
}

function filterBundled(all, lat, lon, radiusM) {
  const out = [];
  for (const s of all) {
    const dist = haversine(lat, lon, s.lat, s.lon);
    if (dist > radiusM + 500) continue;
    out.push({ ...s, dist, distStr: formatDist(dist) });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

const SHOP_TYPES = ['bakery', 'pastry', 'butcher', 'farm', 'organic', 'cheese', 'dairy', 'greengrocer', 'supermarket', 'convenience', 'deli'];

export function buildOverpassQuery(lat, lon, radius) {
  // Égalités exactes (utilisent l'index Overpass → bien plus rapide qu'un regex) et
  // nw (node/way) plutôt que nwr : pas de relations pour des commerces = requête allégée.
  // Mesuré : ~2,6 s à 10 km vs > 35 s (timeout) avec l'ancien regex sur nwr.
  const around = `(around:${radius},${lat},${lon})`;
  const clauses =
    SHOP_TYPES.map((t) => `nw["shop"="${t}"]${around};`).join('') +
    `nw["amenity"="marketplace"]${around};`;
  return `[out:json][timeout:25];(${clauses});out center 300;`;
}

// Cache local par zone + rayon (clé arrondie ~1 km) → réouverture instantanée
const SHOP_TTL = 24 * 3600 * 1000;
function shopCacheKey(lat, lon, r) { return 'locali.shops.' + Math.round(r / 1000) + 'k.' + lat.toFixed(2) + '_' + lon.toFixed(2); }
function readShopCache(lat, lon, r) {
  try { const v = localStorage.getItem(shopCacheKey(lat, lon, r)); if (!v) return null; const o = JSON.parse(v); return (Date.now() - o.ts < SHOP_TTL && Array.isArray(o.shops)) ? o.shops : null; } catch (e) { return null; }
}
// Cache périmé (dernier recours si tous les serveurs Overpass sont indisponibles)
function readStaleCache(lat, lon, r) {
  try { const v = localStorage.getItem(shopCacheKey(lat, lon, r)); if (!v) return null; const o = JSON.parse(v); return Array.isArray(o.shops) && o.shops.length ? o.shops : null; } catch (e) { return null; }
}
function writeShopCache(lat, lon, r, shops) {
  try { localStorage.setItem(shopCacheKey(lat, lon, r), JSON.stringify({ ts: Date.now(), shops })); } catch (e) {}
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

function processShops(elements, lat, lon, radiusM) {
  const seen = new Set();
  const out = [];
  for (const el of elements) {
    const name = el.tags && el.tags.name;
    if (!name || seen.has(name)) continue;
    const elLat = el.lat != null ? el.lat : el.center && el.center.lat;
    const elLon = el.lon != null ? el.lon : el.center && el.center.lon;
    if (elLat == null || elLon == null) continue;
    const dist = haversine(lat, lon, elLat, elLon);
    if (dist > radiusM + 500) continue;
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
export async function loadShops(lat, lon, radiusM = DISCOVERY_RADIUS_M) {
  // 1) Zone embarquée → instantané, précis, fiable (pas de dépendance réseau bloquante)
  if (inBundledBox(lat, lon)) {
    try {
      const all = await loadBundled();
      if (all && all.length) return filterBundled(all, lat, lon, radiusM);
    } catch (e) { /* données embarquées indisponibles → on tente Overpass */ }
  }
  // 2) Hors zone embarquée → requête live Overpass (avec replis)
  const cached = readShopCache(lat, lon, radiusM);
  if (cached) return cached;
  const body = 'data=' + encodeURIComponent(buildOverpassQuery(lat, lon, radiusM));
  let data = null;
  // 1) Course parallèle : le miroir le plus rapide gagne
  try {
    data = await Promise.any(OVERPASS_ENDPOINTS.map((ep) => fetchOverpass(ep, body, 28000)));
  } catch (e) {
    // 2) Repli séquentiel : nouvelle tentative sur le serveur de référence (plus de temps)
    try {
      data = await fetchOverpass(OVERPASS_ENDPOINTS[0], body, 30000);
    } catch (e2) {
      // 3) Dernier recours : un cache même périmé vaut mieux qu'une page d'erreur
      const stale = readStaleCache(lat, lon, radiusM);
      if (stale) return stale;
      throw new Error('overpass-unavailable');
    }
  }
  const shops = processShops(data.elements, lat, lon, radiusM);
  writeShopCache(lat, lon, radiusM, shops);
  return shops;
}
