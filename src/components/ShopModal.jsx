// Fiche boutique + commande (livraison gratuite Locali)
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { getMeta } from '../utils/overpass';
import { isOpenNow } from '../utils/hours';
import { catalogForType, merchantProductsForType, priceLabel } from '../utils/products';
import { addOrder } from '../utils/orders';

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

  useEffect(() => { setQty({}); }, [s]);

  const total = prods.reduce((acc, p, i) => acc + (qty[i] || 0) * p.p, 0);
  const meta = s ? getMeta(s.type) : null;
  const open = s ? isOpenNow(s.hours) : null;
  const stateColor = open === true ? '#2d7a0a' : open === false ? '#b93020' : '#999';
  const stateTxt = open === true ? 'Ouvert maintenant' : open === false ? 'Fermé actuellement' : 'Inconnu';

  const setQ = (i, d) => setQty((q) => ({ ...q, [i]: Math.max(0, (q[i] || 0) + d) }));

  const placeOrder = () => {
    const items = prods
      .map((p, i) => ({ e: p.e, n: p.n, p: p.p, unit: p.unit || null, qty: qty[i] || 0 }))
      .filter((it) => it.qty > 0);
    if (!items.length) { toast('Ajoutez au moins un article'); return; }
    addOrder({
      shopName: s.name, shopType: s.type,
      lat: s.lat != null ? s.lat : null, lon: s.lon != null ? s.lon : null,
      items, total, client: (user && user.name) || 'Client',
    });
    closeShop();
    toast('Commande envoyée ✓ — en attente de validation du commerçant');
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
              <p>{meta.label} · {s.distStr} · Abonné Locali ✓</p>
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
                {meta.label} référencé via OpenStreetMap, à {s.distStr} de vous. Livraison offerte
                grâce à votre abonnement Locali 🌿.
              </div>

              {mineCount > 0 && (
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
                  <span>{s.hours || 'Non renseignés'}</span>
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

              <div className="prodlist">
                <h4>Commander — livraison gratuite Locali 🌿</h4>
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
                <div className="cart-bar" onClick={placeOrder}>
                  <span className="cart-label">Passer la commande</span>
                  <span className="cart-total">{eur(total)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
