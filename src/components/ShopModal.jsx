// Fiche boutique + commande (livraison gratuite Locali)
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { getMeta } from '../utils/overpass';
import { isOpenNow, formatHours, isOpenNowMerchant, formatMerchantHours } from '../utils/hours';
import { catalogForType, merchantProductsForType, priceLabel, getMerchantProfile } from '../utils/products';
import { addOrder } from '../utils/orders';
import { participationOf } from '../utils/participation';
import { fulfillmentFor } from '../utils/delivery';
import { pickSponsor } from '../utils/sponsors';
import HowItWorks from './HowItWorks';

const eur = (n) => Number(n).toFixed(2).replace('.', ',') + ' €';

export default function ShopModal() {
  const { selectedShop: s, closeShop, toast } = useUI();
  const { user } = useAuth();
  // Liste de commande :
  //  - aperçu commerçant : ses propres produits ;
  //  - vrai commerce : les produits du commerçant correspondant à sa catégorie
  //    (s'il en a) remontent en tête, puis le catalogue de la catégorie.
  const prods = useMemo(() => {
    if (!s) return [];
    if (s.products && s.products.length) return s.products;
    const mine = merchantProductsForType(s.type);
    const catalog = catalogForType(s.type);
    const seen = new Set(mine.map((p) => p.n));
    return [...mine, ...catalog.filter((p) => !seen.has(p.n))];
  }, [s]);
  const mineCount = useMemo(() => (s && !s.products ? merchantProductsForType(s.type).length : 0), [s]);
  const [qty, setQty] = useState({});
  const [prefDelivery, setPrefDelivery] = useState(true); // préférence client quand le choix existe
  const [showHow, setShowHow] = useState(false);
  const sponsor = useMemo(() => pickSponsor(), [s]);

  useEffect(() => { setQty({}); setPrefDelivery(true); }, [s]);

  const total = prods.reduce((acc, p, i) => acc + (qty[i] || 0) * p.p, 0);
  const ful = useMemo(() => fulfillmentFor(total, s ? s.id : null), [total, s]);
  // Mode effectif : livraison si autorisée (panier ≥ seuil) et préférée, sinon retrait
  const fulfill = ful.pickupOnly ? 'pickup' : (ful.deliveryAllowed && prefDelivery ? 'delivery' : 'pickup');
  const meta = s ? getMeta(s.type) : null;
  // Si ce commerce est celui du commerçant inscrit, on affiche SES horaires (saisis), sinon OSM
  const profile = getMerchantProfile();
  const isMine = !!(s && profile.shopId && profile.shopId === s.id && profile.hours);
  const open = s ? (isMine ? isOpenNowMerchant(profile.hours) : isOpenNow(s.hours)) : null;
  const hoursText = s ? (isMine ? formatMerchantHours(profile.hours) : s.hours ? formatHours(s.hours) : 'Non renseignés (OSM)') : '';
  const stateColor = open === true ? '#2d7a0a' : open === false ? '#b93020' : '#999';
  const stateTxt = open === true ? 'Ouvert maintenant' : open === false ? 'Fermé actuellement' : 'Inconnu';

  // On ne peut commander que chez un commerce participant (abonné/essai) — ou l'aperçu commerçant
  const part = s ? (s.products && s.products.length ? 'subscribed' : participationOf(s.id)) : 'none';
  const canOrder = part !== 'none';
  const subLabel = !s ? '' : s.products && s.products.length ? 'Votre commerce' : part === 'subscribed' ? 'Abonné Locali ✓' : part === 'trial' ? 'En essai Locali' : 'Pas encore sur Locali';

  const setQ = (i, d) => setQty((q) => ({ ...q, [i]: Math.max(0, (q[i] || 0) + d) }));

  const placeOrder = () => {
    const items = prods
      .map((p, i) => ({ e: p.e, n: p.n, p: p.p, unit: p.unit || null, qty: qty[i] || 0 }))
      .filter((it) => it.qty > 0);
    if (!items.length) { toast('Ajoutez au moins un article'); return; }
    addOrder({
      shopId: s.id, shopName: s.name, shopType: s.type,
      lat: s.lat != null ? s.lat : null, lon: s.lon != null ? s.lon : null,
      items, total, client: (user && user.name) || 'Client',
      fulfillment: fulfill, deliveryFree: fulfill === 'delivery',
    });
    closeShop();
    toast(fulfill === 'delivery'
      ? 'Commande envoyée ✓ — livraison offerte, en attente de validation'
      : 'Commande envoyée ✓ — à retirer en magasin après validation');
  };

  return (
    <div
      className={'modal-overlay' + (s ? ' open' : '')}
      onClick={(e) => { if (e.target === e.currentTarget) closeShop(); }}
    >
      <div className="modal-sheet">
        <div className="mhandle" />
        {s && (
          <>
            <div className="mhead">
              <h3>{s.name}</h3>
              <p>{meta.label} · {s.distStr} · {subLabel}</p>
            </div>
            <div className="mbody">
              <div
                className="mimg"
                style={{ background: `linear-gradient(135deg, ${meta.bg}, ${meta.color}22)` }}
              >
                {meta.emoji}
              </div>
              <div className="mdesc">
                {s.addr ? `📍 ${s.addr} — ` : ''}
                {meta.label}, à {s.distStr} de vous.{canOrder ? ' Livraison offerte grâce à Locali 🌿.' : ''}
              </div>

              {canOrder && mineCount > 0 && (
                <div className="merchant-flag">
                  <i className="ti ti-leaf" /> {mineCount} produit{mineCount > 1 ? 's' : ''} de ce
                  commerçant disponible{mineCount > 1 ? 's' : ''} à la commande
                </div>
              )}

              <div className="mhours">
                <h4>Infos & horaires</h4>
                <div className="hour-row">
                  <span>État</span>
                  <span style={{ color: stateColor, fontWeight: 600 }}>{stateTxt}</span>
                </div>
                <div className="hour-row">
                  <span>Horaires</span>
                  <span>{hoursText}</span>
                </div>
                {isMine && (
                  <div className="hour-row"><span /><span style={{ color: 'var(--g4)', fontWeight: 600 }}>✓ confirmés par le commerçant</span></div>
                )}
                <div className="hour-row">
                  <span>🔎 Vérifier</span>
                  <span
                    style={{ color: 'var(--blue)', cursor: 'pointer' }}
                    onClick={() => window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([s.name, s.addr || '', 'Belgique'].filter(Boolean).join(' ')), '_blank')}
                  >
                    Horaires sur Google ↗
                  </span>
                </div>
                {s.phone && (
                  <div className="hour-row"><span>📞 Téléphone</span><span>{s.phone}</span></div>
                )}
                {s.website && (
                  <div className="hour-row">
                    <span>🌐 Site web</span>
                    <span
                      style={{ color: 'var(--blue)', cursor: 'pointer' }}
                      onClick={() => window.open(s.website, '_blank')}
                    >
                      Ouvrir →
                    </span>
                  </div>
                )}
              </div>

              {canOrder ? (
                <>
                  <div className="prodlist">
                    <h4>Commander 🌿</h4>
                    {prods.map((p, i) => {
                      const grp = p.catLabel || 'Produits du commerçant';
                      const showHeader = i === 0 || grp !== (prods[i - 1].catLabel || 'Produits du commerçant');
                      return (
                        <Fragment key={i}>
                          {showHeader && <div className="prod-group">{grp}</div>}
                          <div className="proditem">
                            <div className="proditem-emoji">{p.e}</div>
                            <div className="proditem-name">{p.n}</div>
                            <div className="proditem-price">{priceLabel(p)}</div>
                            <div className="qty-ctrl">
                              <button className="qty-btn" onClick={() => setQ(i, -1)}>−</button>
                              <span className="qty-num">{qty[i] || 0}</span>
                              <button className="qty-btn" onClick={() => setQ(i, 1)}>+</button>
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>

                  {total > 0 && (
                    <div className="fulfill-box">
                      {ful.pickupOnly ? (
                        <div className="fulfill-line"><i className="ti ti-building-store" /> Retrait en magasin (ce commerce ne livre pas)</div>
                      ) : ful.deliveryAllowed ? (
                        <div className="fulfill-opts">
                          <button className={'fulfill-opt' + (fulfill === 'delivery' ? ' active' : '')} onClick={() => setPrefDelivery(true)}>
                            <i className="ti ti-bike" /> Livraison offerte 🎉
                          </button>
                          <button className={'fulfill-opt' + (fulfill === 'pickup' ? ' active' : '')} onClick={() => setPrefDelivery(false)}>
                            <i className="ti ti-building-store" /> Retrait en magasin
                          </button>
                        </div>
                      ) : (
                        <div className="fulfill-line">
                          <i className="ti ti-building-store" /> Retrait en magasin gratuit · <strong>+{eur(ful.missing)}</strong> pour la livraison offerte
                        </div>
                      )}
                      {fulfill === 'delivery' && sponsor && (
                        <div className="fulfill-sponsor">🤝 Livraison sponsorisée par <strong>{sponsor.name}</strong> — pensez à passer leur faire un coucou pour les remercier !</div>
                      )}
                      <button className="fulfill-note" onClick={() => setShowHow(true)}>
                        Prix identiques au magasin — la livraison est financée par le commerce, jamais par vous. <u>D'où vient l'argent ?</u> 🌿
                      </button>
                    </div>
                  )}

                  {total > 0 && (
                    <div className="cart-bar" onClick={placeOrder}>
                      <span className="cart-label">{fulfill === 'delivery' ? 'Commander · livraison offerte' : 'Commander · retrait magasin'}</span>
                      <span className="cart-total">{eur(total)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="invite-card">
                  <div className="invite-emoji">🌱</div>
                  <h4>Pas encore sur Locali</h4>
                  <p>Vous aimez <strong>{s.name}</strong> ? Glissez-leur un mot sur Locali ! Chaque client qui en parle aide un commerce du coin à rejoindre l'aventure — et à offrir la livraison gratuite. 🌿</p>
                  <button className="invite-btn" onClick={() => toast('Merci ! Votre voix fait avancer le commerce local 🌿')}>
                    <i className="ti ti-speakerphone" /> Parler de Locali à ce commerce
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {showHow && <HowItWorks role="client" onClose={() => setShowHow(false)} />}
    </div>
  );
}
