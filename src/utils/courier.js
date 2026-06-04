// ─── Programme livreur : niveaux basés sur les VRAIES livraisons ─
export const COURIER_LEVELS = [
  { lvl: 1, name: 'Éclaireur',           min: 0,  emoji: '🌱', perk: 'Bienvenue ! Vos courses démarrent ici.' },
  { lvl: 2, name: 'Coursier du quartier', min: 5,  emoji: '🚲', perk: 'Badge Coursier + priorité sur les courses proches.' },
  { lvl: 3, name: 'Pilier local',         min: 15, emoji: '⭐', perk: 'Créneaux prioritaires + visibilité renforcée.' },
  { lvl: 4, name: 'Légende locale',       min: 30, emoji: '🏆', perk: 'Statut Légende + accès aux offres des commerçants partenaires.' },
];

export function courierProgress(count) {
  let cur = COURIER_LEVELS[0];
  for (const l of COURIER_LEVELS) if (count >= l.min) cur = l;
  const next = COURIER_LEVELS.find((l) => l.min > count) || null;
  const base = cur.min;
  const target = next ? next.min : cur.min;
  const pct = next ? Math.min(100, Math.round(((count - base) / (target - base)) * 100)) : 100;
  return { cur, next, pct, count, toNext: next ? next.min - count : 0 };
}
