// ─── Génération des "livraisons déjà effectuées autour" ─
// Données déterministes dérivées des commerces réels proches
// (preuve sociale stable, sans backend).
import { COURIERS } from '../data/constants';

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function agoStr(m) {
  if (m < 60) return 'il y a ' + m + ' min';
  const h = Math.floor(m / 60);
  return 'il y a ' + h + ' h';
}

export function buildLocalDeliveries(shops, radiusKm) {
  const r = radiusKm * 1000;
  const pool = shops.filter((s) => s.dist <= r);
  return pool
    .map((s) => {
      const seed = hashStr(s.name + '|' + radiusKm);
      return {
        shop: s,
        minsAgo: 6 + (seed % 620),
        dur: 9 + ((seed >> 4) % 23),
        courier: COURIERS[seed % COURIERS.length],
      };
    })
    .sort((a, b) => a.minsAgo - b.minsAgo)
    .slice(0, 40);
}
