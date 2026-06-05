// Extrait (une seule fois) TOUS les commerces alimentaires de Belgique depuis Overpass
// → fichier compact embarqué : public/shops-be.json
// Lancement : node scripts/fetch-shops.mjs  (relançable : reprend là où il s'est arrêté)
// Grille fine (tuiles légères même en zone dense) + sauvegarde incrémentale + reprise.
// Schéma compact : [id, type, name, lat, lon, hours, addr, phone, website]
import { readFileSync, writeFileSync, existsSync } from 'fs';

const TYPES = ['bakery', 'pastry', 'butcher', 'farm', 'organic', 'cheese', 'dairy', 'greengrocer', 'supermarket', 'convenience', 'deli'];
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const SHOPS_URL = new URL('../public/shops-be.json', import.meta.url);
const PROG_URL = new URL('./.shops-progress.json', import.meta.url);

// Grille fine : tuiles ~0.5° × 0.65° (assez petites pour Anvers/Bruxelles/Gand)
const LATS = [49.45, 49.975, 50.5, 51.025, 51.55];
const LONS = [2.55, 3.2, 3.85, 4.5, 5.15, 5.8, 6.45];
const TILES = [];
for (let i = 0; i < LATS.length - 1; i++) {
  for (let j = 0; j < LONS.length - 1; j++) TILES.push([LATS[i], LONS[j], LATS[i + 1], LONS[j + 1]]);
}

function buildQuery(bbox) {
  const b = bbox.join(',');
  const clauses = TYPES.map((t) => `nw["shop"="${t}"](${b});`).join('') + `nw["amenity"="marketplace"](${b});`;
  return `[out:json][timeout:90];(${clauses});out center;`;
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
const headers = {
  'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json',
  'User-Agent': 'Locali/1.0 (one-time data extract; carmelocapizzi on github)',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTile(bbox, attempt = 1) {
  const ep = ENDPOINTS[(attempt - 1) % ENDPOINTS.length];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 110000);
  try {
    const res = await fetch(ep, { method: 'POST', headers, body: 'data=' + encodeURIComponent(buildQuery(bbox)), signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data.elements || [];
  } catch (e) {
    clearTimeout(timer);
    if (attempt < 9) {
      const wait = Math.min(8000 * attempt, 60000);
      console.log('  retry', bbox.join(','), '(' + e.message + ') dans ' + wait / 1000 + 's');
      await sleep(wait);
      return fetchTile(bbox, attempt + 1);
    }
    throw e;
  }
}

// Reprise : recharge l'avancement si une extraction précédente a été interrompue
let out = [];
const seen = new Set();
let done = new Set();
if (existsSync(PROG_URL)) {
  try {
    if (existsSync(SHOPS_URL)) { out = JSON.parse(readFileSync(SHOPS_URL)); for (const r of out) seen.add(r[0]); }
    done = new Set(JSON.parse(readFileSync(PROG_URL)).done || []);
    console.log('Reprise : ' + out.length + ' commerces, ' + done.size + ' tuiles déjà faites');
  } catch (e) { out = []; seen.clear(); done = new Set(); }
}

function save() {
  writeFileSync(SHOPS_URL, JSON.stringify(out), 'utf8');
  writeFileSync(PROG_URL, JSON.stringify({ done: [...done] }), 'utf8');
}

for (let k = 0; k < TILES.length; k++) {
  const bbox = TILES[k];
  const key = bbox.join(',');
  if (done.has(key)) { console.log(`Tile ${k + 1}/${TILES.length} [${key}] déjà faite, saut`); continue; }
  process.stdout.write(`Tile ${k + 1}/${TILES.length} [${key}] … `);
  const els = await fetchTile(bbox);
  let added = 0;
  for (const el of els) {
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
    out.push([id, determineType(t), name, Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5,
      t.opening_hours || null, addr, t.phone || t['contact:phone'] || null, t.website || t['contact:website'] || null]);
    added++;
  }
  done.add(key);
  save();
  console.log(els.length + ' éléments, +' + added + ' (total ' + out.length + ')');
  if (k < TILES.length - 1) await sleep(6000);
}

const json = JSON.stringify(out);
console.log('\nTERMINÉ — shops:', out.length, ' (' + (json.length / 1024 / 1024).toFixed(2) + ' MB)');
