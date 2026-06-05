// ─── Modèle de livraison & rémunération (transparent, partagé) ─
// Principe : le prix dans l'app = le prix en magasin (aucune marge sur le client).
// Les coûts sont couverts par une commission payée par le commerçant sur les ventes
// que Locali lui apporte — jamais par une hausse des prix.
import { getShopConfig } from './shopConfig';

export const DEFAULT_FREE_THRESHOLD = 20;   // € — au-dessus : livraison offerte au client
export const COURIER_FEE = 3.0;             // € versés au livreur par livraison (rémunération réelle)
export const COURIER_BATCH_BONUS = 1.0;     // € par commande supplémentaire dans une même tournée
export const COMMISSION_RATE = 0.08;        // commission commerçant (finance livraison + plateforme)

export function effectiveConfig(shopId) {
  const c = getShopConfig(shopId) || {};
  return {
    freeThreshold: c.freeThreshold != null ? c.freeThreshold : DEFAULT_FREE_THRESHOLD,
    deliveryMode: c.deliveryMode || 'delivery', // 'delivery' | 'pickup_only'
    courierPerks: Array.isArray(c.courierPerks) ? c.courierPerks : [],
  };
}

// Que proposer au client selon le panier et la config du commerce ?
export function fulfillmentFor(total, shopId) {
  const cfg = effectiveConfig(shopId);
  if (cfg.deliveryMode === 'pickup_only') {
    return { deliveryFree: false, deliveryAllowed: false, threshold: cfg.freeThreshold, missing: 0, pickupOnly: true };
  }
  const deliveryFree = total >= cfg.freeThreshold;
  return {
    deliveryFree, deliveryAllowed: deliveryFree, threshold: cfg.freeThreshold,
    missing: deliveryFree ? 0 : Math.max(0, cfg.freeThreshold - total), pickupOnly: false,
  };
}

// Rémunération réelle (cash) du livreur pour une liste de livraisons effectuées
export function courierCashFor(deliveredOrders) {
  let total = 0;
  for (const o of deliveredOrders) {
    total += COURIER_FEE;
    if (o.batchSize && o.batchSize > 1) total += COURIER_BATCH_BONUS * (o.batchSize - 1) / o.batchSize;
  }
  return Math.round(total * 100) / 100;
}

export const eur = (n) => Number(n || 0).toFixed(2).replace('.', ',') + ' €';
