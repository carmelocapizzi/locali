// ─── Constantes globales de l'app Locali ────────────────

export const DISCOVERY_RADIUS_M = 15000; // rayon de découverte client (15 km)

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export const TYPE_META = {
  bakery:      { emoji: '🥖', label: 'Boulangerie',             bg: '#fef3e2', color: '#c87020' },
  farm:        { emoji: '🌿', label: 'Ferme / Producteur',      bg: '#e0f5ef', color: '#1a6e50' },
  butcher:     { emoji: '🥩', label: 'Boucherie',               bg: '#fdecea', color: '#b93020' },
  cheese:      { emoji: '🧀', label: 'Fromagerie',              bg: '#fef9e0', color: '#a07010' },
  greengrocer: { emoji: '🥦', label: 'Primeur',                 bg: '#e8fde8', color: '#2a7a2a' },
  supermarket: { emoji: '🛒', label: 'Épicerie / Supermarché',  bg: '#e3f0fb', color: '#1a5a8a' },
  convenience: { emoji: '🏪', label: 'Épicerie de quartier',    bg: '#e3f0fb', color: '#1a5a8a' },
  marketplace: { emoji: '🧺', label: 'Marché',                  bg: '#f3eefe', color: '#6a2ab8' },
  deli:        { emoji: '🥗', label: 'Traiteur / Épicerie fine', bg: '#fef0f8', color: '#a02060' },
  other:       { emoji: '🏬', label: 'Commerce local',          bg: '#f0ece2', color: '#5a5040' },
};

export const CATEGORIES = [
  { key: 'all',         emoji: '🗺️', label: 'Tout',         bg: '#dff0d4' },
  { key: 'bakery',      emoji: '🥖', label: 'Boulangeries',  bg: '#fef3e2' },
  { key: 'farm',        emoji: '🌿', label: 'Fermes',        bg: '#e0f5ef' },
  { key: 'butcher',     emoji: '🥩', label: 'Boucheries',    bg: '#fdecea' },
  { key: 'cheese',      emoji: '🧀', label: 'Fromageries',   bg: '#fef9e0' },
  { key: 'greengrocer', emoji: '🥦', label: 'Primeurs',      bg: '#e8fde8' },
  { key: 'supermarket', emoji: '🛒', label: 'Épiceries',     bg: '#e3f0fb' },
  { key: 'marketplace', emoji: '🧺', label: 'Marchés',       bg: '#f3eefe' },
];

export const MAP_FILTERS = [
  { key: 'all',         label: 'Tous' },
  { key: 'bakery',      label: 'Boulangeries' },
  { key: 'farm',        label: 'Fermes' },
  { key: 'butcher',     label: 'Boucheries' },
  { key: 'greengrocer', label: 'Primeurs' },
  { key: 'supermarket', label: 'Épiceries' },
];

// Produits d'exemple affichés côté client (fiche de commande)
export const SAMPLE_PRODS = {
  bakery:      [{ e: '🥖', n: 'Pain de campagne', p: 3.5 }, { e: '🥐', n: 'Croissant', p: 1.2 }, { e: '🍞', n: 'Baguette', p: 1.4 }],
  farm:        [{ e: '🥦', n: 'Panier légumes (5kg)', p: 15 }, { e: '🥚', n: 'Œufs (x6)', p: 2.8 }, { e: '🥕', n: 'Carottes (1kg)', p: 2.2 }],
  butcher:     [{ e: '🥩', n: 'Entrecôte (300g)', p: 11 }, { e: '🌭', n: 'Merguez (500g)', p: 6.5 }, { e: '🍖', n: 'Côte de porc', p: 7 }],
  cheese:      [{ e: '🧀', n: 'Plateau fromages', p: 14.5 }, { e: '🐐', n: 'Chèvre frais', p: 3.8 }, { e: '🟡', n: 'Comté (200g)', p: 6.2 }],
  greengrocer: [{ e: '🍅', n: 'Tomates (1kg)', p: 3.2 }, { e: '🥬', n: 'Salade', p: 1.5 }, { e: '🫐', n: 'Myrtilles (250g)', p: 3.8 }],
  supermarket: [{ e: '🛒', n: 'Panier courses', p: 25 }, { e: '🥛', n: 'Lait bio (1L)', p: 1.8 }, { e: '🧴', n: 'Yaourts (x4)', p: 2.4 }],
  convenience: [{ e: '🏪', n: 'Épicerie du jour', p: 5 }, { e: '☕', n: 'Café grain (250g)', p: 6.5 }],
  deli:        [{ e: '🥗', n: 'Plat traiteur', p: 9.5 }, { e: '🫒', n: 'Olives marinées', p: 4.2 }],
  marketplace: [{ e: '🧺', n: 'Panier marché', p: 20 }, { e: '🌸', n: 'Bouquet fleurs', p: 8 }],
  other:       [{ e: '🛍️', n: 'Article local', p: 5 }],
};

// ─── Catalogue de produits, classé par familles ─────────
// Chaque produit indique dans quels types de commerce on le trouve (`sells`),
// ce qui permet le "où trouver tel article ?" côté client.
export const PRODUCT_CATALOG = [
  {
    key: 'boulangerie', emoji: '🥖', label: 'Boulangerie & pâtisserie', sells: ['bakery'],
    items: [
      { e: '🥖', n: 'Pain de campagne', p: 3.5, sells: ['bakery'] },
      { e: '🥖', n: 'Baguette tradition', p: 1.4, sells: ['bakery'] },
      { e: '🥐', n: 'Croissant', p: 1.2, sells: ['bakery'] },
      { e: '🥯', n: 'Pain au chocolat', p: 1.3, sells: ['bakery'] },
      { e: '🍰', n: 'Tarte aux pommes', p: 4.0, sells: ['bakery', 'deli'] },
      { e: '🎂', n: 'Gâteau d\'anniversaire', p: 18, sells: ['bakery'] },
    ],
  },
  {
    key: 'fruits_legumes', emoji: '🥦', label: 'Fruits & légumes', sells: ['greengrocer', 'farm', 'marketplace', 'supermarket'],
    items: [
      { e: '🍅', n: 'Tomates (1kg)', p: 3.2, sells: ['greengrocer', 'farm', 'marketplace', 'supermarket'] },
      { e: '🥬', n: 'Salade', p: 1.5, sells: ['greengrocer', 'farm', 'marketplace'] },
      { e: '🥕', n: 'Carottes (1kg)', p: 2.2, sells: ['greengrocer', 'farm', 'marketplace'] },
      { e: '🥔', n: 'Pommes de terre (2kg)', p: 3.0, sells: ['greengrocer', 'farm', 'supermarket'] },
      { e: '🍎', n: 'Pommes (1kg)', p: 2.6, sells: ['greengrocer', 'farm', 'marketplace'] },
      { e: '🍓', n: 'Fraises (250g)', p: 3.5, sells: ['greengrocer', 'farm', 'marketplace'] },
      { e: '🫐', n: 'Myrtilles (250g)', p: 3.8, sells: ['greengrocer', 'marketplace'] },
    ],
  },
  {
    key: 'viandes', emoji: '🥩', label: 'Viandes & volailles', sells: ['butcher'],
    items: [
      { e: '🥩', n: 'Entrecôte (300g)', p: 11, sells: ['butcher'] },
      { e: '🍖', n: 'Côte de porc', p: 7, sells: ['butcher'] },
      { e: '🌭', n: 'Merguez (500g)', p: 6.5, sells: ['butcher'] },
      { e: '🍗', n: 'Poulet fermier', p: 9.5, sells: ['butcher', 'farm'] },
      { e: '🥓', n: 'Lard fumé (200g)', p: 4.2, sells: ['butcher'] },
    ],
  },
  {
    key: 'cremerie', emoji: '🧀', label: 'Crèmerie & fromages', sells: ['cheese', 'farm', 'supermarket'],
    items: [
      { e: '🧀', n: 'Comté (200g)', p: 6.2, sells: ['cheese', 'supermarket'] },
      { e: '🐐', n: 'Chèvre frais', p: 3.8, sells: ['cheese', 'farm', 'marketplace'] },
      { e: '🧀', n: 'Plateau fromages', p: 14.5, sells: ['cheese', 'deli'] },
      { e: '🥛', n: 'Lait (1L)', p: 1.2, sells: ['farm', 'cheese', 'supermarket', 'convenience'] },
      { e: '🥚', n: 'Œufs (x6)', p: 2.8, sells: ['farm', 'cheese', 'supermarket', 'marketplace'] },
      { e: '🧈', n: 'Beurre fermier', p: 2.5, sells: ['farm', 'cheese', 'supermarket'] },
      { e: '🍶', n: 'Yaourts (x4)', p: 2.4, sells: ['supermarket', 'farm', 'cheese'] },
    ],
  },
  {
    key: 'epicerie', emoji: '🛒', label: 'Épicerie', sells: ['supermarket', 'convenience', 'deli'],
    items: [
      { e: '☕', n: 'Café grain (250g)', p: 6.5, sells: ['supermarket', 'convenience', 'deli'] },
      { e: '🍯', n: 'Miel local (500g)', p: 7.5, sells: ['farm', 'marketplace', 'deli', 'supermarket'] },
      { e: '🍝', n: 'Pâtes (500g)', p: 1.5, sells: ['supermarket', 'convenience'] },
      { e: '🫒', n: 'Huile d\'olive (75cl)', p: 8.0, sells: ['supermarket', 'deli'] },
      { e: '🧂', n: 'Épices', p: 3.0, sells: ['supermarket', 'deli', 'convenience'] },
      { e: '🍫', n: 'Chocolat artisanal', p: 2.8, sells: ['supermarket', 'convenience', 'deli'] },
    ],
  },
  {
    key: 'traiteur', emoji: '🥗', label: 'Traiteur', sells: ['deli'],
    items: [
      { e: '🥗', n: 'Plat traiteur du jour', p: 9.5, sells: ['deli'] },
      { e: '🫒', n: 'Olives marinées', p: 4.2, sells: ['deli', 'marketplace'] },
      { e: '🥧', n: 'Quiche', p: 5.5, sells: ['deli', 'bakery'] },
      { e: '🍲', n: 'Soupe maison', p: 4.0, sells: ['deli'] },
    ],
  },
  {
    key: 'marche', emoji: '🧺', label: 'Marché & divers', sells: ['marketplace', 'farm'],
    items: [
      { e: '🧺', n: 'Panier de saison', p: 20, sells: ['marketplace', 'farm'] },
      { e: '🌸', n: 'Bouquet de fleurs', p: 8, sells: ['marketplace'] },
      { e: '🍯', n: 'Confiture artisanale', p: 4.5, sells: ['marketplace', 'farm', 'deli'] },
    ],
  },
];

export const COURIERS = ['Sofia M.', 'Mehdi K.', 'Lucas D.', 'Inès B.', 'Tom R.', 'Nadia S.', 'Yanis L.', 'Clara P.'];

export const PRODUCT_EMOJIS = ['🥖', '🥐', '🍞', '🧀', '🥩', '🥦', '🍅', '🥚', '🍯', '☕', '🍰', '🍎', '🐔', '🥗', '🛍️'];

// Unités de prix proposées au commerçant
export const UNITS = ['pièce', 'kg', '500g', 'L', 'botte', 'lot'];

// Types d'événements locaux publiables par les commerçants
export const EVENT_TYPES = ['Marché', 'Brocante', 'Fête de village', 'Marché de Noël', 'Animation', 'Promo'];

// ─── Marchés hebdomadaires réels des communes voisines ──
// Sources : sites communaux (silly.be, ath.be, lessines.be, soignies.be,
// enghien-edingen.be, geraardsbergen.be) + marches-de-belgique.be.
// day = jour JS : 0=dimanche, 1=lundi … 6=samedi.
export const LOCAL_MARKETS = [
  { id: 'silly',     name: 'Marché de Silly',      commune: 'Silly',          place: 'Grand-Place',               day: 0, start: '08:00', end: '13:00', lat: 50.6516, lon: 3.9214 },
  { id: 'gerb',      name: 'Markt Geraardsbergen', commune: 'Geraardsbergen', place: 'Marktplein',                day: 1, start: '08:00', end: '12:30', lat: 50.7716, lon: 3.8760 },
  { id: 'soignies',  name: 'Marché de Soignies',   commune: 'Soignies',       place: 'Grand-Place / Place Verte', day: 2, start: '08:00', end: '13:00', lat: 50.5793, lon: 4.0707 },
  { id: 'ollignies', name: "Marché d'Ollignies",   commune: 'Lessines',       place: "Place d'Ollignies",         day: 3, start: '08:00', end: '12:30', lat: 50.7007, lon: 3.8556 },
  { id: 'enghien',   name: "Marché d'Enghien",     commune: 'Enghien',        place: 'Église Saint-Nicolas',      day: 3, start: '08:00', end: '13:30', lat: 50.6948, lon: 4.0353 },
  { id: 'ath',       name: "Marché d'Ath",         commune: 'Ath',            place: 'Église Saint-Julien',       day: 4, start: '08:00', end: '13:00', lat: 50.6293, lon: 3.7782 },
  { id: 'lessines',  name: 'Marché de Lessines',   commune: 'Lessines',       place: 'Grand-Place',               day: 6, start: '08:00', end: '13:00', lat: 50.7112, lon: 3.8330 },
];

// Rôles disponibles à la connexion
export const ROLES = [
  { key: 'client',     emoji: '🛒', label: 'Client',     desc: 'Commander local, livré gratuitement' },
  { key: 'commercant', emoji: '🏪', label: 'Commerçant', desc: 'Vendez et gérez vos produits' },
  { key: 'livreur',    emoji: '🚴', label: 'Livreur',    desc: 'Effectuez des courses près de vous' },
];
