import { useMemo, useState } from 'react';
import { useLocali } from '../../context/LocaliContext';
import { useUI } from '../../context/UIContext';
import { useAuth } from '../../context/AuthContext';
import { getMeta } from '../../utils/overpass';
import { loadOrders, updateOrder, itemsLabel, agoStr, isToday, haversine, formatDist } from '../../utils/orders';

export default function Delivery() {
  const { lat, lon } = useLocali();
  const { toast } = useUI();
  const { user } = useAuth();
  const [radius, setRadius] = useState(10);
  const [orders, setOrders] = useState(loadOrders);

  const courier = (user && user.name) || 'Livreur';
  const refresh = () => setOrders(loadOrders());

  const dist = (o) => (lat != null && o.lat != null ? haversine(lat, lon, o.lat, o.lon) : null);
  const inRadius = (o) => { const d = dist(o); return d == null || d <= radius * 1000; };

  const available = useMemo(() => orders.filter((o) => o.status === 'accepted' && inRadius(o)), [orders, radius, lat, lon]);
  const mine = useMemo(() => orders.filter((o) => o.status === 'delivering' && o.courier === courier), [orders, courier]);
  const deliveredToday = useMemo(() => orders.filter((o) => o.status === 'delivered' && o.courier === courier && isToday(o.deliveredAt)).length, [orders, courier]);

  const take = (o) => { updateOrder(o.id, { status: 'delivering', courier, deliveringAt: Date.now() }); refresh(); toast('Course acceptée 🚴 — ' + o.shopName); };
  const confirm = (o) => { updateOrder(o.id, { status: 'delivered', deliveredAt: Date.now() }); refresh(); toast('Réception confirmée ✓ — livrée à ' + (o.client || 'client')); };

  const queue = [...mine, ...available]; // mes courses en cours d'abord

  return (
    <div className="sc-delivery">
      <div className="dhead">
        <h2>Espace Livreur</h2>
        <p>Courses validées par les commerçants, près de vous</p>
        <div className="online-dot">
          <div className="dot-pulse" />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>En ligne · {courier}</span>
        </div>
      </div>

      <div className="dstatwrap">
        <div className="dstat"><div className="val">{available.length}</div><div className="lbl">À livrer</div></div>
        <div className="dstat"><div className="val">{mine.length}</div><div className="lbl">En cours</div></div>
        <div className="dstat"><div className="val">{deliveredToday}</div><div className="lbl">Livrées aujourd'hui</div></div>
      </div>

      <div style={{ padding: '6px 16px 0' }}>
        <div className="radius-chips dradius">
          {[5, 10, 20].map((km) => (
            <div key={km} className={'rchip' + (radius === km ? ' active' : '')} onClick={() => setRadius(km)}>{km} km</div>
          ))}
        </div>
      </div>

      <div className="seclabel" style={{ padding: '10px 16px 10px' }}>
        {queue.length ? queue.length : 'Aucune'} course{queue.length > 1 ? 's' : ''} dans {radius} km
      </div>

      <div>
        {queue.length === 0 && (
          <div className="empty-mini">
            Aucune course disponible.<br />Une course apparaît ici dès qu'un commerçant valide une commande.
          </div>
        )}
        {queue.map((o) => {
          const meta = getMeta(o.shopType);
          const d = dist(o);
          const taken = o.status === 'delivering';
          return (
            <div className="pickcard" key={o.id}>
              <div className="pickhead" style={{ background: meta.color }}>
                <span>{meta.emoji} {o.shopName.length > 22 ? o.shopName.slice(0, 22) + '…' : o.shopName}</span>
                <span className="picktime"><i className="ti ti-clock" style={{ fontSize: 10 }} /> {agoStr(o.acceptedAt || o.createdAt)}</span>
              </div>
              <div className="pickbody">
                <div className="pickshop">Commande {o.ref}{taken ? ' · en cours' : ''}</div>
                <div className="pickaddr"><i className="ti ti-map-pin" style={{ fontSize: 12 }} /> {d != null ? 'Collecte à ' + formatDist(d) : 'Collecte'} · client : {o.client || '—'}</div>
                <div className="pickitems">{itemsLabel(o.items)}<br /><strong>→ Livrer à :</strong> le client {o.client || ''} (livraison gratuite Locali)</div>
                <div className="pickactions">
                  <button className="btnmap" onClick={() => toast('Navigation GPS lancée 🗺️')}><i className="ti ti-map" /> Itinéraire</button>
                  {taken ? (
                    <button className="btnacc" onClick={() => confirm(o)}><i className="ti ti-package" /> Confirmer la réception</button>
                  ) : (
                    <button className="btnacc" onClick={() => take(o)}><i className="ti ti-check" /> Prendre la course</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
