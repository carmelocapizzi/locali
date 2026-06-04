import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useLocali } from '../../context/LocaliContext';
import { useUI } from '../../context/UIContext';
import { getMeta } from '../../utils/overpass';
import { buildLocalDeliveries, agoStr, hashStr } from '../../utils/deliveries';
import { PRODUCT_EMOJIS, PRODUCT_CATALOG, UNITS, EVENT_TYPES } from '../../data/constants';
import { priceLabel } from '../../utils/products';
import { loadEvents, saveEvents } from '../../utils/events';

const MKEY = 'locali.merchant';
const eur = (n) => Number(n).toFixed(2).replace('.', ',') + ' €';

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
      return { subscribed: !!m.subscribed, trialUntil: m.trialUntil || null, products, library };
    }
  } catch (e) {}
  return { subscribed: false, trialUntil: null, products: [], library: [] };
}

// Mémorise un produit dans la bibliothèque (récurrents), sans doublon de nom
function upsertLibrary(library, prod) {
  const entry = { e: prod.e, n: prod.n, p: prod.p, sells: prod.sells || [], unit: prod.unit || 'pièce' };
  if (library.some((p) => p.n === entry.n)) return library.map((p) => (p.n === entry.n ? entry : p));
  return [...library, entry];
}

export default function Merchant() {
  const { lat, lon, city, shops } = useLocali();
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

  useEffect(() => {
    try { localStorage.setItem(MKEY, JSON.stringify(merchant)); } catch (e) {}
  }, [merchant]);

  useEffect(() => { saveEvents(events); }, [events]);

  const publishEvent = () => {
    if (!evt.title.trim()) { toast('Indiquez un titre'); return; }
    if (!evt.date) { toast('Choisissez une date'); return; }
    const e = {
      id: 'evt-' + Date.now(), title: evt.title.trim(), type: evt.type, date: evt.date,
      place: evt.place.trim() || (city && city !== 'Détection en cours…' ? city : ''), lat, lon,
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

  // ── Livraisons déjà effectuées autour (toujours visible) ──
  const dels = useMemo(() => buildLocalDeliveries(shops, radius), [shops, radius]);
  const pool = useMemo(() => shops.filter((s) => s.dist <= radius * 1000), [shops, radius]);
  const weekly = Math.round(pool.length * 1.6) + (hashStr('week|' + radius) % 18) + 6;
  const avg = dels.length ? Math.round(dels.reduce((a, d) => a + d.dur, 0) / dels.length) : 0;
  const couriers = new Set(dels.map((d) => d.courier)).size;

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
    dels.forEach((d) => {
      L.marker([d.shop.lat, d.shop.lon], {
        icon: L.divIcon({ html: '<div class="deliv-dot"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] }),
      }).addTo(layer).bindPopup(`<b>${d.shop.name}</b><br>Livré en ${d.dur} min · ${d.courier}<br><small>${agoStr(d.minsAgo)}</small>`);
    });
  }, [dels, radius, lat, lon]);

  // ── Actions abonnement ──
  const subscribe = () => { setMerchant((m) => ({ ...m, subscribed: true, trialUntil: null })); toast('Abonnement Pro activé 🌿'); };
  const startTrial = () => { setMerchant((m) => ({ ...m, trialUntil: Date.now() + 7 * 86400000 })); toast('Accès gratuit 7 jours activé ✓'); };
  const cancel = () => { setMerchant((m) => ({ ...m, subscribed: false, trialUntil: null })); toast('Abonnement désactivé'); };

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
        <h3>Livraisons autour de vous</h3>
        <p className="msec-sub">
          Courses déjà effectuées par les livreurs Locali dans votre rayon d'action — la preuve que
          la livraison locale tourne déjà près de votre commerce.
        </p>
        <div className="radius-chips">
          {[3, 5, 10].map((km) => (
            <div key={km} className={'rchip' + (radius === km ? ' active' : '')} onClick={() => setRadius(km)}>{km} km</div>
          ))}
        </div>
        <div className="merchant-mapwrap">
          <div id="merchant-map" ref={mapEl} />
          <div className="mm-badge"><strong>{weekly}</strong> livraisons cette semaine</div>
        </div>
        <div className="deliv-stats">
          <div className="dstat2"><div className="v">{weekly}</div><div className="l">Courses livrées<br />dans {radius} km</div></div>
          <div className="dstat2"><div className="v">{avg || '—'}<small>min</small></div><div className="l">Temps moyen<br />de livraison</div></div>
          <div className="dstat2"><div className="v">{couriers || '—'}</div><div className="l">Livreurs Locali<br />actifs autour</div></div>
        </div>
        <div className="seclabel">Activité récente dans le rayon</div>
        {dels.length === 0 ? (
          <div className="empty-mini">Aucune livraison enregistrée dans ce rayon pour le moment.<br />Élargissez le rayon pour voir l'activité voisine.</div>
        ) : (
          dels.slice(0, 12).map((d, i) => {
            const meta = getMeta(d.shop.type);
            return (
              <div className="dfeed-item" key={i} onClick={() => mapRef.current && mapRef.current.setView([d.shop.lat, d.shop.lon], 15)}>
                <div className="dfeed-ic" style={{ background: meta.bg }}>{meta.emoji}</div>
                <div className="dfeed-main">
                  <div className="dfeed-shop">{d.shop.name} <span className="dfeed-check">✓ livré</span></div>
                  <div className="dfeed-sub">Livré en {d.dur} min · {d.courier} · {d.shop.distStr} · {agoStr(d.minsAgo)}</div>
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

          <div className="statsgrid">
            <div className="statcard"><div className="statval">127</div><div className="statlbl">Commandes ce mois</div><div className="stattrend">↑ +18%</div></div>
            <div className="statcard"><div className="statval">38</div><div className="statlbl">Livraisons Locali</div><div className="stattrend">↑ +6 cette semaine</div></div>
            <div className="statcard"><div className="statval">4.8★</div><div className="statlbl">Note moyenne</div><div className="stattrend">89 avis</div></div>
            <div className="statcard"><div className="statval">1,2k</div><div className="statlbl">Vues profil</div><div className="stattrend">↑ +24%</div></div>
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
    </div>
  );
}
