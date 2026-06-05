// Extrait (une seule fois) les commerces alimentaires de la région depuis Overpass
// et écrit un fichier compact embarqué dans l'app : public/shops-be.json
// Lancement : node scripts/fetch-shops.mjs
// Schéma compact : [id, type, name, lat, lon, hours, addr, phone, website]
import { writeFileSync } from 'fs';

const BBOX = '50.35,3.35,51.05,4.75'; // Hainaut + Brabant wallon + sud Bruxelles
const TYPES = ['bakery', 'pastry', 'butcher', 'farm', 'organic', 'cheese', 'dairy', 'greengrocer', 'supermarket', 'convenience', 'deli'];
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

function buildQuery() {
  const clauses = TYPES.map((t) => `nw["shop"="${t}"](${BBOX});`).join('') + `nw["amenity"="marketplace"](${BBOX});`;
  return `[out:json][timeout:150];(${clauses});out center;`;
}

function determineType(tags) {
  const s = tags.shop || '', a = tags.amenity || '';
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

const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 160000);
const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'User-Agent': 'Locali/1.0 (one-time data extract; contact carmelocapizzi on github)',
  },
  body: 'data=' + encodeURIComponent(buildQuery()),
  signal: ctrl.signal,
});
clearTimeout(timer);
if (!res.ok) { console.error('Overpass HTTP', res.status); process.exit(1); }
const data = await res.json(); // décodage UTF-8 correct

const seen = new Set();
const out = [];
for (const el of data.elements) {
  const t = el.tags || {};
  const name = t.name;
  if (!name) continue;
  const lat = el.lat != null ? el.lat : el.center && el.center.lat;
  const lon = el.lon != null ? el.lon : el.center && el.center.lon;
  if (lat == null || lon == null) continue;
  const id = el.type + '/' + el.id;
  if (seen.has(id)) continue;
  seen.add(id);
  const addr = t['addr:street']
    ? t['addr:street'] + (t['addr:housenumber'] ? ' ' + t['addr:housenumber'] : '') + (t['addr:city'] ? ', ' + t['addr:city'] : '')
    : (t['addr:city'] || null);
  out.push([
    id, determineType(t), name,
    Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5,
    t.opening_hours || null, addr,
    t.phone || t['contact:phone'] || null,
    t.website || t['contact:website'] || null,
  ]);
}

const json = JSON.stringify(out);
writeFileSync(new URL('../public/shops-be.json', import.meta.url), json, 'utf8');
console.log('shops:', out.length, ' bytes:', json.length, ' (' + (json.length / 1024 / 1024).toFixed(2) + ' MB)');
console.log('sample:', out.slice(0, 3).map((r) => r[2]).join(' | '));
