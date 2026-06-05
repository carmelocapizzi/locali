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

// Géocodage inverse via Nominatim -> nom de ville
export async function reverseGeocode(lat, lon) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`
  );
  const d = await res.json();
  const addr = d.address || {};
  const city =
    addr.suburb || addr.city_district || addr.town || addr.village ||
    addr.city || addr.municipality || 'Votre position';
  const country = addr.country || '';
  return city + (country ? ', ' + country : '');
}

// Géocodage direct (commune / code postal) -> { lat, lon, label }
// Biais Belgique : un code postal comme « 1430 » ou « Rebecq » est résolu correctement.
export async function geocodePlace(query) {
  const q = encodeURIComponent(String(query).trim());
  const url =
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1` +
    `&accept-language=fr&countrycodes=be&addressdetails=1`;
  const res = await fetch(url);
  const d = await res.json();
  if (!d || !d.length) throw new Error('place-not-found');
  const a = d[0].address || {};
  const town = a.village || a.town || a.city || a.municipality || a.suburb || '';
  const label = town ? town + (a.postcode ? ' ' + a.postcode : '') : (d[0].display_name || query).split(',').slice(0, 2).join(', ');
  return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon), label };
}
