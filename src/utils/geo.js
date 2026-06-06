// ─── Helpers géographiques ──────────────────────────────

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDist(m) {
  if (m < 1000) return Math.round(m) + 'm';
  return (m / 1000).toFixed(1).replace('.', ',') + 'km';
}

// fetch JSON avec délai dur (AbortController) → ne reste jamais bloqué
async function fetchJson(url, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

// Géocodage inverse -> nom de ville (Photon puis Nominatim ; non bloquant)
export async function reverseGeocode(lat, lon) {
  try {
    const d = await fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=fr`, 8000);
    const p = (d && d.features && d.features[0] && d.features[0].properties) || {};
    const city = p.city || p.name || p.town || p.village || p.county || '';
    if (city) return city + (p.country ? ', ' + p.country : '');
  } catch (e) { /* repli Nominatim */ }
  const d = await fetchJson(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`, 8000);
  const addr = d.address || {};
  const city = addr.suburb || addr.city_district || addr.town || addr.village || addr.city || addr.municipality || 'Votre position';
  return city + (addr.country ? ', ' + addr.country : '');
}

// Géocodage direct (commune / code postal) -> { lat, lon, label }
// Photon (komoot, OSM, compatible mobile/CORS) en priorité, repli Nominatim. Biais Belgique.
export async function geocodePlace(query) {
  const raw = String(query).trim();
  const q = encodeURIComponent(raw);

  // 1) Photon — robuste depuis un mobile, pas de blocage de réseau fréquent
  try {
    const d = await fetchJson(`https://photon.komoot.io/api/?q=${q}&limit=5&lang=fr&lat=50.6&lon=4.5`, 9000);
    const feats = (d && d.features) || [];
    const be = feats.find((f) => f.properties && f.properties.countrycode === 'BE') || feats[0];
    if (be && be.geometry && be.geometry.coordinates) {
      const [lon, lat] = be.geometry.coordinates;
      const p = be.properties || {};
      const town = p.city || p.name || p.town || p.village || p.county || raw;
      const label = town + (p.postcode ? ' ' + p.postcode : '');
      return { lat, lon, label };
    }
  } catch (e) { /* repli Nominatim */ }

  // 2) Nominatim — repli
  const d = await fetchJson(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&accept-language=fr&countrycodes=be&addressdetails=1`,
    9000
  );
  if (!d || !d.length) throw new Error('place-not-found');
  const a = d[0].address || {};
  const town = a.village || a.town || a.city || a.municipality || a.suburb || '';
  const label = town ? town + (a.postcode ? ' ' + a.postcode : '') : (d[0].display_name || raw).split(',').slice(0, 2).join(', ');
  return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon), label };
}
