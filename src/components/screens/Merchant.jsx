import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useLocali } from '../../context/LocaliContext';
import { useUI } from '../../context/UIContext';
import { getMeta } from '../../utils/overpass';
import { PRODUCT_EMOJIS, PRODUCT_CATALOG, UNITS, EVENT_TYPES, TYPE_META } from '../../data/constants';
import { priceLabel } from '../../utils/products';
import { loadEvents, saveEvents } from '../../utils/events';
import { loadOrders, updateOrder, agoStr, durMin, itemsLabel, statusPill, haversine } from '../../utils/orders';
import { setParticipation } from '../../utils/participation';
import { addCustomShop } from '../../utils/customShops';
import { setShopConfig } from '../../utils/shopConfig';
import { COURIER_FEE, COMMISSION_RATE } from '../../utils/delivery';
import { loadSponsors, upsertSponsor, removeSponsor } from '../../utils/sponsors';
import HowItWorks from '../HowItWorks';
import { DAY_KEYS, DAY_LABELS } from '../../utils/hours';

const MKEY = 'locali.merchant';
const eur = (n) => Number(n).toFixed(2).replace('.', ',') + ' €';
const DEFAULT_HOURS = { Mo: { o: '08:00', c: '18:00' }, Tu: { o: '08:00', c: '18:00' }, We: { o: '08:00', c: '18:00' }, Th: { o: '08:00', c: '18:00' }, Fr: { o: '08:00', c: '18:00' }, Sa: { o: '08:00', c: '12:30' }, Su: null };
const TYPE_OPTIONS = Object.entries(TYPE_META);

function loadMerchant() {
  try {
    const raw = localStorage.getItem(MKEY);
    if (raw) {
      const m = JSON.parse(raw);
      const products = Array.isArray(m.products) ? m.products : [];
      let library = Array.isArray(m.library) ? m.library : [];
      // Migration : on sème la bibliothèque depuis les produits déjà créés
      if (!library.length && products.length) {
        library = products.map((p) => ({ e: p.e, n: p.n, p: p.p, sells: p.sells || [], unit: p.unit || 'pièce' }));
      }
      return {
        subscribed: !!m.subscribed, trialUntil: m.trialUntil || null, products, library,
        shopId: m.shopId || null, shopName: m.shopName || null, shopType: m.shopType || null,
        shopLat: m.shopLat != null ? m.shopLat : null, shopLon: m.shopLon != null ? m.shopLon : null,
        hours: m.hours || null,
        deliveryMode: m.deliveryMode || 'delivery', freeThreshold: m.freeThreshold != null ? m.freeThreshold : 20,
        courierPerks: Array.isArray(m.courierPerks) ? m.courierPerks : [],
      };
    }
  } catch (e) {}
  return { subscribed: false, trialUntil: null, products: [], library: [], shopId: null, shopName: null, shopType: null, shopLat: null, shopLon: null, hours: null, deliveryMode: 'delivery', freeThreshold: 20, courierPerks: [] };
}

// Mémorise un produit dans la bibliothèque (récurrents), sans doublon de nom
function upsertLibrary(library, prod) {
  const entry = { e: prod.e, n: prod.n, p: prod.p, sells: prod.sells || [], unit: prod.unit || 'pièce' };
  if (library.some((p) => p.n === entry.n)) return library.map((p) => (p.n === entry.n ? entry : p));
  return [...library, entry];
}

export default function Merchant() {
  const { lat, lon, city, shops, refreshCustom } = useLocali();
  const { toast, openShop } = useUI();

  const [merchant, setMerchant] = useState(loadMerchant);
  const [radius, setRadius] = useState(5);
  const [emoji, setEmoji] = useState('🥖');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [pcat, setPcat] = useState(PRODUCT_CATALOG[0].key);
  const [unit, setUnit] = useState('pièce');
  const [events, setEvents] = useState(loadEvents);
  const [evt, setEvt] = useState({ title: '', type: EVENT_TYPES[0], date: '', place: '' });
  const [shopQuery, setShopQuery] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ name: '', type: 'bakery', addr: '' });
  const [orders, setOrders] = useState(loadOrders);
  const refreshOrders = () => setOrders(loadOrders());

  useEffect(() => {
    try { localStorage.setItem(MKEY, JSON.stringify(merchant)); } catch (e) {}
  }, [merchant]);

  useEffect(() => { saveEvents(events); }, [events]);

  // Synchronise la participation du commerce désigné (selon abonnement / essai)
  useEffect(() => {
    if (!merchant.shopId) return;
    const status = merchant.subscribed ? 'subscribed' : (merchant.trialUntil && Date.now() < merchant.trialUntil ? 'trial' : 'none');
    setParticipation(merchant.shopId, status);
  }, [merchant.shopId, merchant.subscribed, merchant.trialUntil]);

  // Publie les réglages livraison + avantages livreurs (lus par clients et livreurs)
  useEffect(() => {
    if (!merchant.shopId) return;
    setShopConfig(merchant.shopId, {
      shopName: merchant.shopName, freeThreshold: merchant.freeThreshold,
      deliveryMode: merchant.deliveryMode, courierPerks: merchant.courierPerks,
    });
  }, [merchant.shopId, merchant.shopName, merchant.freeThreshold, merchant.deliveryMode, merchant.courierPerks]);

  const [perk, setPerk] = useState({ label: '', detail: '' });
  const addPerk = () => {
    if (!perk.label.trim()) { toast('Décrivez l\'avantage'); return; }
    setMerchant((m) => ({ ...m, courierPerks: [...(m.courierPerks || []), { id: 'pk-' + Date.now(), label: perk.label.trim(), detail: perk.detail.trim() }] }));
    setPerk({ label: '', detail: '' });
    toast('Avantage livreur ajouté ✓');
  };
  const removePerk = (id) => setMerchant((m) => ({ ...m, courierPerks: (m.courierPerks || []).filter((p) => p.id !== id) }));

  // Sponsoring : le commerce peut financer les livraisons offertes du quartier (visibilité en échange)
  const [showHow, setShowHow] = useState(false);
  const sponsorId = merchant.shopId ? 'sp-' + merchant.shopId : null;
  const [isSponsor, setIsSponsor] = useState(false);
  useEffect(() => { setIsSponsor(sponsorId ? loadSponsors().some((x) => x.id === sponsorId) : false); }, [sponsorId]);
  const toggleSponsor = () => {
    if (!merchant.shopId) return;
    if (isSponsor) { removeSponsor(sponsorId); setIsSponsor(false); toast('Sponsoring désactivé'); }
    else { upsertSponsor({ id: sponsorId, name: merchant.shopName || 'Commerce local', type: merchant.shopType, active: true }); setIsSponsor(true); toast('Merci ! Vous sponsorisez les livraisons du quartier 🤝'); }
  };

  const claimShop = (id) => {
    const sh = shops.find((x) => x.id === id);
    if (!sh) { setMerchant((m) => ({ ...m, shopId: null })); return; }
    setMerchant((m) => ({ ...m, shopId: sh.id, shopName: sh.name, shopType: sh.type, shopLat: sh.lat, shopLon: sh.lon, hours: m.hours || DEFAULT_HOURS }));
    toast(sh.name + ' désigné comme votre commerce');
  };
  const setDayHours = (k, val) => setMerchant((m) => ({ ...m, hours: { ...(m.hours || DEFAULT_HOURS), [k]: val } }));

  // Recherche du commerce à désigner (sur TOUS les commerces, pas seulement 60)
  const claimResults = useMemo(() => {
    const q = shopQuery.trim().toLowerCase();
    if (!q) return shops.slice(0, 8);
    return shops.filter((sh) => sh.name.toLowerCase().includes(q) || getMeta(sh.type).label.toLowerCase().includes(q)).slice(0, 25);
  }, [shops, shopQuery]);

  // Ajout manuel d'un commerce absent d'OpenStreetMap
  const addManualShop = () => {
    if (!manual.name.trim()) { toast('Indiquez le nom du commerce'); return; }
    if (lat == null) { toast('Position non disponible'); return; }
    const shop = { id: 'manual/' + Date.now(), name: manual.name.trim(), type: manual.type, lat, lon, hours: null, addr: manual.addr.trim() || null, custom: true };
    addCustomShop(shop);
    if (refreshCustom) refreshCustom();
    setMerchant((m) => ({ ...m, shopId: shop.id, shopName: shop.name, shopType: shop.type, shopLat: shop.lat, shopLon: shop.lon, hours: m.hours || DEFAULT_HOURS }));
    setShowManual(false);
    setManual({ name: '', type: 'bakery', addr: '' });
    toast(shop.name + ' créé et désigné comme votre commerce ✓');
  };

  const publishEvent = () => {
    if (!evt.title.trim()) { toast('Indiquez un titre'); return; }
    if (!evt.date) { toast('Choisissez une date'); return; }
    const e = {
      id: 'evt-' + Date.now(), title: evt.title.trim(), type: evt.type, date: evt.date,
      place: evt.place.trim() || (city && city !== 'Détection en cours…' ? city : ''),
      lat: merchant.shopLat != null ? merchant.shopLat : lat,
      lon: merchant.shopLon != null ? merchant.shopLon : lon,
      source: 'merchant', shopId: merchant.shopId || null, shopName: merchant.shopName || null, shopType: merchant.shopType || null,
    };
    setEvents((prev) => [...prev, e]);
    setEvt({ title: '', type: EVENT_TYPES[0], date: '', place: '' });
    toast('Événement publié ✓ — visible dans « Marchés & événements »');
  };
  const deleteEvent = (id) => setEvents((prev) => prev.filter((e) => e.id !== id));
  const upcomingEvents = events
    .filter((e) => e.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const access = merchant.subscribed || (merchant.trialUntil && Date.now() < merchant.trialUntil);
  const trial = !merchant.subscribed && merchant.trialUntil && Date.now() < merchant.trialUntil;
  const trialDays = merchant.trialUntil ? Math.max(0, Math.ceil((merchant.trialUntil - Date.now()) / 86400000)) : 0;

  // ── Données RÉELLES issues des commandes (aucun chiffre fictif) ──
  const inRadius = (o) => { const d = (lat != null && o.lat != null) ? haversine(lat, lon, o.lat, o.lon) : null; return d == null || d <= radius * 1000; };
  const incoming = useMemo(() => orders.filter((o) => o.status === 'pending').sort((a, b) => b.createdAt - a.createdAt), [orders]);
  const inProgress = useMemo(() => orders.filter((o) => o.status === 'accepted' || o.status === 'delivering').sort((a, b) => b.createdAt - a.createdAt), [orders]);
  const delivered = useMemo(() => orders.filter((o) => o.status === 'delivered' && inRadius(o)), [orders, radius, lat, lon]);
  const deliveredCount = delivered.length;
  const avg = delivered.length ? Math.round(delivered.reduce((a, o) => a + (durMin(o.createdAt, o.deliveredAt) || 0), 0) / delivered.length) : 0;
  const couriers = new Set(delivered.map((o) => o.courier).filter(Boolean)).size;

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (lat == null || !mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false }).setView([lat, lon], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(map);
    L.marker([lat, lon], {
      icon: L.divIcon({ html: '<div class="shop-pin">🏪</div>', className: '', iconSize: [34, 34], iconAnchor: [17, 30] }),
    }).addTo(map).bindPopup('🏪 Votre commerce');
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 140);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; circleRef.current = null; };
  }, [lat, lon]);

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    if (circleRef.current) map.removeLayer(circleRef.current);
    const circle = L.circle([lat, lon], { radius: radius * 1000, color: '#b56a2b', weight: 1.5, fillColor: '#b56a2b', fillOpacity: 0.06, dashArray: '4 5' }).addTo(map);
    circleRef.current = circle;
    map.fitBounds(circle.getBounds(), { padding: [18, 18] });
    layer.clearLayers();
    delivered.forEach((o) => {
      if (o.lat == null) return;
      const d = durMin(o.createdAt, o.deliveredAt);
      L.marker([o.lat, o.lon], {
        icon: L.divIcon({ html: '<div class="deliv-dot"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] }),
      }).addTo(layer).bindPopup(`<b>${o.shopName}</b><br>Livré${d ? ' en ' + d + ' min' : ''}${o.courier ? ' · ' + o.courier : ''}<br><small>${agoStr(o.deliveredAt)}</small>`);
    });
  }, [delivered, radius, lat, lon]);

  // ── Actions abonnement ──
  const subscribe = () => { setMerchant((m) => ({ ...m, subscribed: true, trialUntil: null })); toast('Abonnement Pro activé 🌿'); };
  const startTrial = () => { setMerchant((m) => ({ ...m, trialUntil: Date.now() + 7 * 86400000 })); toast('Accès gratuit 7 jours activé ✓'); };
  const cancel = () => { setMerchant((m) => ({ ...m, subscribed: false, trialUntil: null })); toast('Abonnement désactivé'); };

  // ── Validation des commandes par le commerçant ──
  const acceptOrder = (o) => { updateOrder(o.id, { status: 'accepted', acceptedAt: Date.now() }); refreshOrders(); toast('Commande validée ✓ — disponible pour un livreur'); };

  // ── Gestion des produits ──
  const addProduct = () => {
    const p = parseFloat((price || '').replace(',', '.'));
    if (!name.trim()) { toast('Indiquez le nom du produit'); return; }
    if (isNaN(p) || p < 0) { toast('Indiquez un prix valide'); return; }
    const fam = PRODUCT_CATALOG.find((c) => c.key === pcat);
    const prod = { e: emoji, n: name.trim(), p, on: true, sells: fam ? fam.sells : [], unit };
    setMerchant((m) => ({ ...m, products: [...m.products, prod], library: upsertLibrary(m.library, prod) }));
    setName(''); setPrice('');
    toast('Produit ajouté ✓');
  };
  const toggleProduct = (i) => setMerchant((m) => ({ ...m, products: m.products.map((p, idx) => (idx === i ? { ...p, on: !p.on } : p)) }));
  const removeProduct = (i) => setMerchant((m) => ({ ...m, products: m.products.filter((_, idx) => idx !== i) }));
  const avail = merchant.products.filter((p) => p.on);

  // Catalogue : ajout en un tap
  const currentFamily = PRODUCT_CATALOG.find((c) => c.key === pcat) || PRODUCT_CATALOG[0];
  const addFromCatalog = (it) => {
    if (merchant.products.some((p) => p.n === it.n)) { toast(it.n + ' est déjà dans votre liste'); return; }
    const prod = { e: it.e, n: it.n, p: it.p, on: true, sells: it.sells, unit: it.u || 'pièce' };
    setMerchant((m) => ({ ...m, products: [...m.products, prod], library: upsertLibrary(m.library, prod) }));
    toast(it.n + ' ajouté ✓');
  };

  // Produits récurrents : remémorés, remis à la commande en 1 tap
  const reAddFromLibrary = (it) => {
    if (merchant.products.some((p) => p.n === it.n)) { toast(it.n + ' est déjà proposé'); return; }
    setMerchant((m) => ({ ...m, products: [...m.products, { ...it, on: true }] }));
    toast(it.n + ' remis à la commande ✓');
  };
  const forgetFromLibrary = (n) => setMerchant((m) => ({ ...m, library: m.library.filter((p) => p.n !== n) }));
  // Ouvre la fiche de commande telle que la verra le client
  const viewAsClient = () => {
    if (!avail.length) { toast('Activez au moins un produit'); return; }
    const guess = (avail.find((p) => p.sells && p.sells.length) || {}).sells;
    openShop({
      id: 'me-preview',
      name: 'Votre commerce (aperçu client)',
      type: (guess && guess[0]) || 'other',
      distStr: 'votre adresse',
      hours: null, addr: null, phone: null, website: null,
      products: avail,
    });
  };

  return (
    <div className="sc-merchant">
      <div className="mhead2">
        <h2>Espace Commerçant</h2>
        <p>{city && city !== 'Détection en cours…' ? 'Votre commerce · ' + city : 'Gérez votre présence Locali'}</p>
      </div>

      {/* Carte d'abonnement / accès */}
      <div className="abocard">
        {access ? (
          <>
            <div className="abolabel">{trial ? 'Accès gratuit temporaire' : 'Abonnement actif'}</div>
            <div className="aboplan">Plan Pro Locali 🌿</div>
            <ul className="abofeats">
              <li>Prise de commande activée</li>
              <li>Gestion libre de vos produits</li>
              <li>Livraisons 0 € pour vos clients</li>
              <li>Statistiques en temps réel</li>
              <li>Visibilité prioritaire sur la carte</li>
            </ul>
            {trial ? (
              <>
                <div className="abo-trial">⏳ Essai gratuit — {trialDays} jour(s) restant(s)</div>
                <button className="abo-btn" onClick={subscribe}>Passer à l'abonnement — 49 €/mois</button>
              </>
            ) : (
              <>
                <div className="aboprice">49 € <span>/ mois TTC</span></div>
                <button className="abo-btn light" onClick={cancel}>Gérer l'abonnement</button>
              </>
            )}
          </>
        ) : (
          <>
            <div className="abolabel">Aucun abonnement actif</div>
            <div className="aboplan">Débloquez la prise de commande 🌿</div>
            <ul className="abofeats">
              <li>Listez vos produits à la commande</li>
              <li>Recevez des commandes livrées 0 €</li>
              <li>Statistiques & publications</li>
            </ul>
            <div className="aboprice">49 € <span>/ mois TTC</span></div>
            <button className="abo-btn" onClick={subscribe}>S'abonner</button>
            <button className="abo-btn light" onClick={startTrial}>Activer 7 jours gratuits</button>
          </>
        )}
      </div>

      {/* TEASER toujours visible : livraisons déjà effectuées dans le rayon */}
      <div className="msec">
        <h3>Livraisons réalisées autour de vous</h3>
        <p className="msec-sub">
          Les livraisons effectuées via Locali dans votre rayon d'action s'affichent ici au fur et à
          mesure. Données réelles — vide tant qu'aucune livraison n'a eu lieu.
        </p>
        <div className="radius-chips">
          {[3, 5, 10].map((km) => (
            <div key={km} className={'rchip' + (radius === km ? ' active' : '')} onClick={() => setRadius(km)}>{km} km</div>
          ))}
        </div>
        <div className="merchant-mapwrap">
          <div id="merchant-map" ref={mapEl} />
          <div className="mm-badge"><strong>{deliveredCount}</strong> livraison{deliveredCount > 1 ? 's' : ''} dans {radius} km</div>
        </div>
        <div className="deliv-stats">
          <div className="dstat2"><div className="v">{deliveredCount}</div><div className="l">Livraisons<br />dans {radius} km</div></div>
          <div className="dstat2"><div className="v">{avg || '—'}{avg ? <small>min</small> : null}</div><div className="l">Temps moyen<br />de livraison</div></div>
          <div className="dstat2"><div className="v">{couriers || '—'}</div><div className="l">Livreurs<br />impliqués</div></div>
        </div>
        <div className="seclabel">Dernières livraisons</div>
        {delivered.length === 0 ? (
          <div className="empty-mini">Aucune livraison pour l'instant.<br />Elles apparaîtront dès qu'une commande aura été livrée.</div>
        ) : (
          delivered.slice().sort((a, b) => b.deliveredAt - a.deliveredAt).slice(0, 12).map((o) => {
            const meta = getMeta(o.shopType);
            const d = durMin(o.createdAt, o.deliveredAt);
            return (
              <div className="dfeed-item" key={o.id} onClick={() => mapRef.current && o.lat != null && mapRef.current.setView([o.lat, o.lon], 15)}>
                <div className="dfeed-ic" style={{ background: meta.bg }}>{meta.emoji}</div>
                <div className="dfeed-main">
                  <div className="dfeed-shop">{o.shopName} <span className="dfeed-check">✓ livré</span></div>
                  <div className="dfeed-sub">{d ? 'Livré en ' + d + ' min' : 'Livré'}{o.courier ? ' · ' + o.courier : ''} · {agoStr(o.deliveredAt)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ZONE PREMIUM : verrouillée sans abo / essai */}
      {!access ? (
        <div className="paywall">
          <div className="lock"><i className="ti ti-lock" /></div>
          <h4>Réservé aux commerçants abonnés</h4>
          <p>Sans abonnement, vous visualisez uniquement les livraisons déjà effectuées autour de vous. Débloquez la prise de commande et la gestion de vos produits.</p>
          <div className="pw-btns">
            <button className="pw-btn primary" onClick={subscribe}>S'abonner — 49 €/mois</button>
            <button className="pw-btn ghost" onClick={startTrial}>Activer 7 jours gratuits</button>
          </div>
        </div>
      ) : (
        <>
          <div className="msec">
            <h3>Commandes reçues</h3>
            <p className="msec-sub">Validez les commandes de vos clients : une fois validée, elle devient disponible pour un livreur.</p>
            {incoming.length === 0 && inProgress.length === 0 ? (
              <div className="empty-mini">Aucune commande pour le moment. Les commandes de vos clients arrivent ici.</div>
            ) : (
              <>
                {incoming.map((o) => (
                  <div className="ordcard" key={o.id} style={{ margin: '0 0 10px' }}>
                    <div className="ordtop">
                      <div><div className="ordshop">{getMeta(o.shopType).emoji} {o.shopName}</div><div className="ordnum">{o.ref} · {o.client} · {agoStr(o.createdAt)}</div></div>
                      <span className="spill s-prep">À valider</span>
                    </div>
                    <div className="orditems">{itemsLabel(o.items)}</div>
                    <div className="ordfooter">
                      <span className="ordtotal">{eur(o.total)}</span>
                      <button className="ordbtn" onClick={() => acceptOrder(o)}>Valider la commande</button>
                    </div>
                  </div>
                ))}
                {inProgress.map((o) => {
                  const pill = statusPill(o.status);
                  return (
                    <div className="ordcard" key={o.id} style={{ margin: '0 0 10px' }}>
                      <div className="ordtop">
                        <div><div className="ordshop">{getMeta(o.shopType).emoji} {o.shopName}</div><div className="ordnum">{o.ref} · {o.client}</div></div>
                        <span className={'spill ' + pill.c}>{pill.t}</span>
                      </div>
                      <div className="orditems">{itemsLabel(o.items)}<br />{o.status === 'accepted' ? "→ en attente d'un livreur" : '→ en livraison' + (o.courier ? ' par ' + o.courier : '')}</div>
                      <div className="ordfooter"><span className="ordtotal">{eur(o.total)}</span></div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="msec">
            <h3>Mon commerce &amp; horaires</h3>
            <p className="msec-sub">Désignez votre commerce (il sera coloré sur la carte selon votre statut) et renseignez vos horaires réels — ils s'afficheront à vos clients.</p>

            {merchant.shopId ? (
              <div className="claim-current">
                <span>✓ Votre commerce : <strong>{merchant.shopName}</strong></span>
                <button className="claim-change" onClick={() => setMerchant((m) => ({ ...m, shopId: null }))}>changer</button>
              </div>
            ) : (
              <>
                <input
                  className="np-family"
                  type="text"
                  placeholder="🔎 Cherchez votre commerce par nom…"
                  value={shopQuery}
                  onChange={(e) => setShopQuery(e.target.value)}
                />
                <div className="claim-list">
                  {claimResults.length === 0 ? (
                    <div className="empty-mini">Aucun commerce trouvé{shopQuery ? ' pour « ' + shopQuery + ' »' : ''}.</div>
                  ) : (
                    claimResults.map((sh) => (
                      <button key={sh.id} className="claim-item" onClick={() => claimShop(sh.id)}>
                        <span className="claim-name">{getMeta(sh.type).emoji} {sh.name}</span>
                        <span className="claim-sub">{getMeta(sh.type).label} · {sh.distStr}</span>
                      </button>
                    ))
                  )}
                </div>
                <button className="claim-manual-toggle" onClick={() => setShowManual((v) => !v)}>
                  <i className="ti ti-plus" /> Mon commerce n'est pas dans la liste
                </button>
                {showManual && (
                  <div className="prod-add" style={{ marginTop: 8 }}>
                    <input className="evt-title" type="text" placeholder="Nom du commerce" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
                    <div className="evt-row">
                      <select className="evt-type" value={manual.type} onChange={(e) => setManual({ ...manual, type: e.target.value })}>
                        {TYPE_OPTIONS.map(([k, m]) => (<option key={k} value={k}>{m.emoji} {m.label}</option>))}
                      </select>
                    </div>
                    <input className="evt-place" type="text" placeholder="Adresse (optionnel)" value={manual.addr} onChange={(e) => setManual({ ...manual, addr: e.target.value })} />
                    <button className="np-add np-add-full" onClick={addManualShop}>+ Créer mon commerce</button>
                    <div className="claim-hint">Placé à votre position actuelle, visible par les clients du coin.</div>
                  </div>
                )}
              </>
            )}

            {merchant.shopId && (
              <>
                <div className="seclabel" style={{ marginTop: 10 }}>Vos horaires (réels, affichés aux clients)</div>
                <div className="hours-editor">
                  {DAY_KEYS.map((k) => {
                    const d = (merchant.hours || DEFAULT_HOURS)[k];
                    const openDay = !!d;
                    return (
                      <div className="hrow" key={k}>
                        <span className="hday">{DAY_LABELS[k]}</span>
                        <button className={'htoggle' + (openDay ? ' on' : '')} onClick={() => setDayHours(k, openDay ? null : { o: '08:00', c: '18:00' })}>
                          {openDay ? 'Ouvert' : 'Fermé'}
                        </button>
                        {openDay && (
                          <>
                            <input type="time" className="htime" value={d.o} onChange={(e) => setDayHours(k, { ...d, o: e.target.value })} />
                            <span className="hsep">–</span>
                            <input type="time" className="htime" value={d.c} onChange={(e) => setDayHours(k, { ...d, c: e.target.value })} />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {merchant.shopId && (
            <div className="msec">
              <h3>Livraison &amp; livreurs</h3>
              <p className="msec-sub">
                Les prix dans l'app sont identiques à votre magasin. La livraison est financée par votre commission
                ({Math.round(COMMISSION_RATE * 100)} % sur les ventes que Locali vous apporte) — jamais par une hausse des prix.
              </p>

              <div className="seclabel">Mode de remise</div>
              <div className="deliv-mode">
                <button className={'dm-opt' + (merchant.deliveryMode !== 'pickup_only' ? ' active' : '')} onClick={() => setMerchant((m) => ({ ...m, deliveryMode: 'delivery' }))}>
                  <i className="ti ti-bike" /> Livraison + retrait
                </button>
                <button className={'dm-opt' + (merchant.deliveryMode === 'pickup_only' ? ' active' : '')} onClick={() => setMerchant((m) => ({ ...m, deliveryMode: 'pickup_only' }))}>
                  <i className="ti ti-building-store" /> Retrait seulement
                </button>
              </div>

              {merchant.deliveryMode !== 'pickup_only' && (
                <div className="thresh-row">
                  <span>Livraison offerte dès</span>
                  <input type="number" min="0" step="1" value={merchant.freeThreshold}
                    onChange={(e) => setMerchant((m) => ({ ...m, freeThreshold: Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
                  <span>€ de panier</span>
                </div>
              )}
              <div className="deliv-info">
                En dessous du seuil, le client retire en magasin (gratuit). Le livreur reçoit <strong>{COURIER_FEE.toFixed(0)} € par livraison</strong> (rémunération réelle), plus vos avantages ci-dessous.
              </div>

              <div className="seclabel" style={{ marginTop: 12 }}>Avantages que vous offrez aux livreurs</div>
              <p className="msec-sub" style={{ marginTop: 0 }}>En plus de leur rémunération. Coût marginal faible pour vous, forte valeur pour le livreur — qui devient votre ambassadeur. 🌿</p>
              <div className="perk-edit">
                {(merchant.courierPerks || []).map((p) => (
                  <div className="perk-chip" key={p.id}>
                    <span>{p.label}{p.detail ? ' — ' + p.detail : ''}</span>
                    <button onClick={() => removePerk(p.id)} title="Retirer"><i className="ti ti-x" /></button>
                  </div>
                ))}
                {(merchant.courierPerks || []).length === 0 && <div className="empty-mini" style={{ margin: 0 }}>Aucun avantage proposé pour l'instant.</div>}
              </div>
              <div className="perk-add">
                <input type="text" placeholder="Avantage (ex. −10 % sur vos achats)" value={perk.label} onChange={(e) => setPerk({ ...perk, label: e.target.value })} />
                <input type="text" placeholder="Détail (ex. dès 5 livraisons)" value={perk.detail} onChange={(e) => setPerk({ ...perk, detail: e.target.value })} />
                <button className="np-add np-add-full" onClick={addPerk}>+ Proposer cet avantage</button>
              </div>

              <div className="seclabel" style={{ marginTop: 12 }}>Sponsoriser les livraisons du quartier</div>
              <div className="sponsor-box">
                <p>Financez les livraisons offertes autour de vous. En échange : votre nom sur « Livraison offerte avec le soutien de… », un badge <strong>Sponsor local 🤝</strong> et la visibilité d'un commerce qui soutient la proximité.</p>
                <button className={'sponsor-btn' + (isSponsor ? ' on' : '')} onClick={toggleSponsor}>
                  {isSponsor ? '✓ Vous êtes sponsor local' : '🤝 Devenir sponsor local'}
                </button>
              </div>

              <button className="howlink" onClick={() => setShowHow(true)}>💡 D'où vient l'argent ? Voir le circuit complet</button>
            </div>
          )}

          <div className="msec">
            <h3>Vos produits à la commande</h3>
            <p className="msec-sub">
              Ajoutez en un tap depuis le catalogue (classé par familles), ou créez un produit sur
              mesure. Tout ce que vous activez apparaît dans la fiche de commande de vos clients.
            </p>

            {merchant.library.length > 0 && (
              <>
                <div className="seclabel">Mes produits récurrents — 1 tap pour les remettre</div>
                <div className="lib-chips">
                  {merchant.library.map((it, i) => {
                    const activeProd = merchant.products.some((p) => p.n === it.n);
                    return (
                      <div key={i} className={'libchip' + (activeProd ? ' on' : '')}>
                        <button className="libchip-add" disabled={activeProd} onClick={() => reAddFromLibrary(it)}>
                          {it.e} {it.n}{activeProd ? ' ✓' : ''}
                        </button>
                        <span className="libchip-x" title="Oublier ce produit" onClick={() => forgetFromLibrary(it.n)}>×</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="seclabel">Ajouter depuis le catalogue</div>
            <div className="catalog-cats">
              {PRODUCT_CATALOG.map((c) => (
                <button key={c.key} className={'catchip' + (pcat === c.key ? ' active' : '')} onClick={() => setPcat(c.key)}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            <div className="catalog-items">
              {currentFamily.items.map((it, idx) => {
                const added = merchant.products.some((p) => p.n === it.n);
                return (
                  <button key={idx} className={'catitem' + (added ? ' added' : '')} onClick={() => addFromCatalog(it)}>
                    <span className="catitem-e">{it.e}</span>
                    <span className="catitem-n">{it.n}</span>
                    <span className="catitem-p">{eur(it.p)}</span>
                    <i className={'ti ' + (added ? 'ti-check' : 'ti-plus')} />
                  </button>
                );
              })}
            </div>

            <div className="seclabel" style={{ marginTop: 8 }}>Ou créez un produit sur mesure</div>
            <div className="prod-add">
              <label className="np-flabel">Famille du produit (détermine sur quels commerces il apparaît)</label>
              <select
                className="np-family"
                value={pcat}
                onChange={(e) => { const k = e.target.value; setPcat(k); const fam = PRODUCT_CATALOG.find((c) => c.key === k); if (fam) setEmoji(fam.emoji); }}
              >
                {PRODUCT_CATALOG.map((c) => (
                  <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                ))}
              </select>
              <div className="emoji-pick">
                {PRODUCT_EMOJIS.map((e) => (
                  <div key={e} className={'ep' + (emoji === e ? ' active' : '')} onClick={() => setEmoji(e)}>{e}</div>
                ))}
              </div>
              <div className="np-row">
                <input id="np-name" type="text" placeholder="Nom (ex. Pain complet)" value={name} onChange={(e) => setName(e.target.value)} />
                <input id="np-price" type="text" inputMode="decimal" placeholder="Prix €" value={price} onChange={(e) => setPrice(e.target.value)} />
                <select className="np-unit" value={unit} onChange={(e) => setUnit(e.target.value)} title="Unité de prix">
                  {UNITS.map((u) => (<option key={u} value={u}>/{u}</option>))}
                </select>
              </div>
              <button className="np-add np-add-full" onClick={addProduct}>+ Ajouter ce produit</button>
            </div>

            {merchant.products.length === 0 ? (
              <div className="empty-mini">Aucun produit pour le moment.<br />Ajoutez votre premier produit à la commande ci-dessus 👆</div>
            ) : (
              merchant.products.map((p, i) => (
                <div className="prodrow" key={i}>
                  <div className="prodemo">{p.e || '🛍️'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="prodname">{p.n}</div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: p.on ? '#2d7a0a' : '#bbb' }}>
                      {p.on ? 'Disponible à la commande' : 'Masqué pour les clients'}
                    </div>
                  </div>
                  <div className="prodprice">{priceLabel(p)}</div>
                  <div className={'toggle' + (p.on ? '' : ' off')} title="Disponibilité" onClick={() => toggleProduct(i)} />
                  <i className="ti ti-trash" style={{ color: '#ccc', fontSize: 18, cursor: 'pointer', marginLeft: 2 }} title="Supprimer" onClick={() => removeProduct(i)} />
                </div>
              ))
            )}

            <div className="seclabel" style={{ marginTop: 14 }}>Aperçu client — la fiche de commande</div>
            <div className="preview-box">
              {avail.length === 0 ? (
                <div className="empty-mini">Activez des produits pour voir l'aperçu de la fiche client.</div>
              ) : (
                avail.map((p, i) => (
                  <div className="proditem" key={i}>
                    <div className="proditem-emoji">{p.e}</div>
                    <div className="proditem-name">{p.n}</div>
                    <div className="proditem-price">{priceLabel(p)}</div>
                  </div>
                ))
              )}
            </div>
            <button className="view-client-btn" disabled={!avail.length} onClick={viewAsClient}>
              <i className="ti ti-eye" /> Voir la fiche comme un client
            </button>
          </div>

          <div className="msec">
            <h3>Vos événements locaux</h3>
            <p className="msec-sub">
              Annoncez un marché, une brocante, une fête de village, une animation ou une promo.
              Vos événements apparaissent dans l'onglet « Marchés &amp; événements » des clients autour de vous.
            </p>
            <div className="evt-add">
              <input className="evt-title" type="text" placeholder="Titre (ex. Brocante de la Grand-Place)" value={evt.title} onChange={(e) => setEvt({ ...evt, title: e.target.value })} />
              <div className="evt-row">
                <select className="evt-type" value={evt.type} onChange={(e) => setEvt({ ...evt, type: e.target.value })}>
                  {EVENT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
                <input className="evt-date" type="date" value={evt.date} onChange={(e) => setEvt({ ...evt, date: e.target.value })} />
              </div>
              <input className="evt-place" type="text" placeholder="Lieu (ex. Grand-Place de Silly)" value={evt.place} onChange={(e) => setEvt({ ...evt, place: e.target.value })} />
              <button className="np-add np-add-full" onClick={publishEvent}>+ Publier l'événement</button>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="empty-mini">Aucun événement publié pour le moment.</div>
            ) : (
              upcomingEvents.map((e) => (
                <div className="prodrow" key={e.id}>
                  <div className="prodemo">📅</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="prodname">{e.title}</div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: '#9a9484' }}>
                      {e.type} · {e.date}{e.place ? ' · ' + e.place : ''}
                    </div>
                  </div>
                  <i className="ti ti-trash" style={{ color: '#ccc', fontSize: 18, cursor: 'pointer' }} title="Supprimer" onClick={() => deleteEvent(e.id)} />
                </div>
              ))
            )}
          </div>
        </>
      )}
      <div style={{ height: 16 }} />
      {showHow && <HowItWorks role="commercant" onClose={() => setShowHow(false)} />}
    </div>
  );
}
