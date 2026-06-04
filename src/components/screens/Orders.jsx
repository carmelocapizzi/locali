import { useMemo, useState } from 'react';
import { useUI } from '../../context/UIContext';
import { getMeta } from '../../utils/overpass';
import { loadOrders, ORDER_STEPS, statusStep, statusPill, itemsLabel, agoStr } from '../../utils/orders';

const eur = (n) => Number(n).toFixed(2).replace('.', ',') + ' €';

export default function Orders() {
  const { toast } = useUI();
  const [tab, setTab] = useState('active');
  const [orders] = useState(loadOrders);

  const active = useMemo(() => orders.filter((o) => o.status !== 'delivered').sort((a, b) => b.createdAt - a.createdAt), [orders]);
  const history = useMemo(() => orders.filter((o) => o.status === 'delivered').sort((a, b) => b.deliveredAt - a.deliveredAt), [orders]);
  const list = tab === 'active' ? active : history;

  return (
    <div className="sc-orders">
      <div className="ordhead">
        <h2>Mes commandes</h2>
        <p>{active.length} commande{active.length > 1 ? 's' : ''} en cours</p>
      </div>
      <div className="tabs">
        <div className={'tab' + (tab === 'active' ? ' active' : '')} onClick={() => setTab('active')}>En cours</div>
        <div className={'tab' + (tab === 'history' ? ' active' : '')} onClick={() => setTab('history')}>Historique</div>
      </div>

      {list.length === 0 ? (
        <div className="loading-state" style={{ paddingTop: 40 }}>
          <i className="ti ti-shopping-bag" style={{ fontSize: 34, color: '#ccc' }} />
          <p>{tab === 'active' ? "Aucune commande en cours.\nCommandez chez un commerce local !" : 'Aucune commande passée.'}</p>
        </div>
      ) : (
        <div style={{ paddingBottom: 20 }}>
          {list.map((o) => {
            const meta = getMeta(o.shopType);
            const pill = statusPill(o.status);
            const step = statusStep(o.status);
            return (
              <div className="ordcard" key={o.id}>
                <div className="ordtop">
                  <div>
                    <div className="ordshop">{meta.emoji} {o.shopName}</div>
                    <div className="ordnum">{o.ref} · {agoStr(o.createdAt)}</div>
                  </div>
                  <span className={'spill ' + pill.c}>{pill.t}</span>
                </div>
                <div className="tracker">
                  {ORDER_STEPS.map((lbl, i) => (
                    <div className="tstep" key={i}>
                      <div className={'tdot' + (i < step ? ' done' : i === step ? ' cur' : '')}>
                        {i < step ? <i className="ti ti-check" style={{ fontSize: 9 }} /> : i === step && i === 2 ? <i className="ti ti-bike" style={{ fontSize: 9, color: 'var(--g4)' }} /> : null}
                      </div>
                      <div className="tlbl">{lbl}</div>
                    </div>
                  ))}
                </div>
                <div className="orditems">
                  {itemsLabel(o.items)}<br />→ Livraison gratuite Locali 🌿
                  {o.status === 'pending' && ' · en attente du commerçant'}
                  {o.status === 'delivering' && o.courier ? ' · livreur : ' + o.courier : ''}
                </div>
                <div className="ordfooter">
                  <span className="ordtotal">{eur(o.total)}</span>
                  <button className="ordbtn" onClick={() => toast(pill.t)}>
                    {o.status === 'delivered' ? 'Recommander' : 'Suivre'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
