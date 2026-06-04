// ─── Catalogue produits : recherche + "où trouver" ──────
import { PRODUCT_CATALOG, TYPE_META } from '../data/constants';

// Tous les produits aplatis, enrichis de leur famille
export const ALL_PRODUCTS = PRODUCT_CATALOG.flatMap((c) =>
  c.items.map((it) => ({ ...it, cat: c.key, catLabel: c.label, catEmoji: c.emoji }))
);

// Prix formaté avec unité : "3,50 €" ou "3,50 € / kg"
export function priceLabel(p) {
  const base = Number(p.p).toFixed(2).replace('.', ',') + ' €';
  return p.unit && p.unit !== 'pièce' ? base + ' / ' + p.unit : base;
}

// Produits commandables dans un commerce d'un type donné
export function catalogForType(type) {
  const list = ALL_PRODUCTS.filter((p) => (p.sells || []).includes(type));
  // Repli : pour un type inconnu, on propose une petite épicerie générique
  return list.length ? list : ALL_PRODUCTS.filter((p) => p.cat === 'epicerie').slice(0, 4);
}

// Recherche d'un article par nom
export function findProducts(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  return ALL_PRODUCTS.filter((p) => p.n.toLowerCase().includes(q));
}

// Où trouver un article : liste unique des types de commerce concernés
export function whereToFind(product) {
  return (product.sells || []).map((type) => ({
    type,
    emoji: (TYPE_META[type] || TYPE_META.other).emoji,
    label: (TYPE_META[type] || TYPE_META.other).label,
  }));
}

// Produits enregistrés par le commerçant (localStorage), uniquement les actifs.
// Même clé que l'écran Commerçant ('locali.merchant').
export function getMerchantProducts() {
  try {
    const raw = localStorage.getItem('locali.merchant');
    if (!raw) return [];
    const m = JSON.parse(raw);
    return Array.isArray(m.products) ? m.products.filter((p) => p.on) : [];
  } catch (e) {
    return [];
  }
}

// Produits du commerçant pertinents pour un type de commerce donné
// (ex. ses produits "bakery" remontent sur les boulangeries de la carte).
export function merchantProductsForType(type) {
  return getMerchantProducts().filter((p) => (p.sells || []).includes(type));
}
