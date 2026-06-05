import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocali } from '../../context/LocaliContext';
import { useUI } from '../../context/UIContext';
import { useAuth } from '../../context/AuthContext';
import { getMeta } from '../../utils/overpass';
import { loadOrders, updateOrder, itemsLabel, agoStr, isToday, haversine, formatDist } from '../../utils/orders';
import { courierProgress } from '../../utils/courier';
import { participationOf } from '../../utils/participation';
import { courierCashFor, eur, COURIER_FEE, COURIER_BATCH_BONUS } from '../../utils/delivery';
import { allCourierPerks } from '../../utils/shopConfig';
import HowItWorks from '../HowItWorks';

export default function Delivery() {
  const { lat, lon } = useLocali();
  const { toast } = useUI();
  const { user } = useAuth();
  const [radius, setRadius] = useState(10);
  const [orders, setOrders] = useState(loadOrders);
  const [sel, setSel] = useState(() => new Set()); // tournée groupée : ids sélectionnés
  const [showHow, setShowHow] = useState(false);

  const courier = (user && user.name) || 'Livreur';
  const refresh = () => setOrders(loadOrders());

  const dist = (o) => (lat != null && o.lat != null ? haversine(lat, lon, o.lat, o.lon) : null);
  const inRadius = (o) => { const d = dist(o); return d == null || d <= radius * 1000; };

  const partOf = (o) => participationOf(o.shopId);
  // Seules les commandes EN LIVRAISON arrivent au livreur (les retraits en magasin n'en ont pas besoin)
  const available = useMemo(
    () => orders.filter((o) => o.status === 'accepted' && o.fulfillment !== 'pickup' && inRadius(o))
      .sort((a, b) => (partOf(b) === 'trial' ? 1 : 0) - (partOf(a) === 'trial' ? 1 : 0)),
    [orders, radius, lat, lon]
  );
  const trialCount = available.filter((o) => partOf(o) === 'trial').length;
  const mine = useMemo(() => orders.filter((o) => o.status === 'delivering' && o.courier === courier), [orders, courier]);
  const deliveredToday = useMemo(() => orders.filter((o) => o.status === 'delivered' && o.courier === courier && isToday(o.deliveredAt)).length, [orders, courier]);

  // Programme livreur : niveaux basés sur les VRAIES livraisons effectuées
  const deliveredAll = useMemo(() => orders.filter((o) => o.status === 'delivered' && o.courier === courier), [orders, courier]);
  const totalDelivered = deliveredAll.length;
  const earned = useMemo(() => courierCashFor(deliveredAll), [deliveredAll]);
  const prog = courierProgress(totalDelivered);
  const perks = useMemo(() => allCourierPerks(), [orders]);
  const lastAvail = useRef(0);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);
  // Notification de montée de niveau
  useEffect(() => {
    let last = 1;
    try { last = +(localStorage.getItem('locali.courierLevel') || 1); } catch (e) {}
    if (prog.cur.lvl > last) {
      try { if (window.Notification && Notification.permission === 'granted') new Notification('🎉 Niveau débloqué : ' + prog.cur.name, { body: prog.cur.perk }); } catch (e) {}
    }
    try { localStorage.setItem('locali.courierLevel', String(prog.cur.lvl)); } catch (e) {}
  }, [prog.cur.lvl, prog.cur.name, prog.cur.perk]);
  // Notification de nouvelle course
  useEffect(() => {
    if (available.length > lastAvail.current && lastAvail.current !== 0) {
      try { if (window.Notification && Notification.permission === 'granted') new Notification('🚲 Nouvelle course disponible', { body: available.length + ' course(s) près de vous' }); } catch (e) {}
    }
    lastAvail.current = available.length;
  }, [available.length]);

  const take = (o) => { updateOrder(o.id, { status: 'delivering', courier, deliveringAt: Date.now(), batchSize: 1 }); refresh(); toast('Course acceptée 🚴 — ' + o.shopName); };
  const confirm = (o) => { updateOrder(o.id, { status: 'delivered', deliveredAt: Date.now() }); refresh(); toast('Réception confirmée ✓ — livrée à ' + (o.client || 'client')); };

  const toggleSel = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const batchEarn = sel.size * COURIER_FEE + Math.max(0, sel.size - 1) * COURIER_BATCH_BONUS;
  const takeBatch = () => {
    const ids = [...sel]; const n = ids.length;
    ids.forEach((id) => updateOrder(id, { status: 'delivering', courier, deliveringAt: Date.now(), batchSize: n }));
    setSel(new Set()); refresh();
    toast(`Tournée de ${n} course${n > 1 ? 's' : ''} acceptée 🚴 · ~${eur(batchEarn)}`);
  };

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

      {/* Programme livreur : niveau + barre de progression (données réelles) */}
      <div className="lvlcard">
        <div className="lvltop">
          <span className="lvlname">{prog.cur.emoji} {prog.cur.name}</span>
          <span className="lvlnum">Niveau {prog.cur.lvl} · {totalDelivered} livraison{totalDelivered > 1 ? 's' : ''}</span>
        </div>
        <div className="lvlbar"><div className="lvlfill" style={{ width: prog.pct + '%' }} /></div>
        <div className="lvlsub">
          {prog.next ? `Plus que ${prog.toNext} livraison${prog.toNext > 1 ? 's' : ''} pour ${prog.next.emoji} ${prog.next.name}` : 'Niveau maximum atteint 🏆'}
        </div>
        <div className="lvlperk"><i className="ti ti-gift" /> {prog.cur.perk}</div>
      </div>

      {/* Rémunération réelle (cash) — en plus des avantages partenaires */}
      <div className="earn-card">
        <div>
          <div className="earn-val">{eur(earned)}</div>
          <div className="earn-lbl">Gagnés (réel) · {COURIER_FEE.toFixed(0)}€ par livraison{deliveredToday ? ` · ${deliveredToday} aujourd'hui` : ''}</div>
        </div>
        <div className="earn-note">+ avantages des<br />commerçants partenaires</div>
      </div>
      <button className="howlink dark" onClick={() => setShowHow(true)}>💡 Qui paie mes courses ? Comment ça marche ?</button>

      {perks.length > 0 && (
        <div className="perks-card">
          <div className="perks-title"><i className="ti ti-gift" /> Avantages offerts par les commerçants</div>
          {perks.map((p, i) => (
            <div className="perk-row" key={i}>
              <span className="perk-shop">{p.shopName || 'Commerce'}</span>
              <span className="perk-label">{p.label}{p.detail ? ' — ' + p.detail : ''}</span>
            </div>
          ))}
        </div>
      )}

      {trialCount > 0 && (
        <div className="opp-banner">
          <div className="opp-title">✨ Nouvelle opportunité</div>
          <div className="opp-text">
            {trialCount} commerce{trialCount > 1 ? 's' : ''} en <strong>période d'essai</strong> près de vous — assurez leurs livraisons pour les convaincre de rejoindre l'aventure 🌿
          </div>
        </div>
      )}
      {available.length > 0 && trialCount === 0 && (
        <div className="course-alert"><i className="ti ti-bell-ringing" /> {available.length} course{available.length > 1 ? 's' : ''} disponible{available.length > 1 ? 's' : ''} à proximité !</div>
      )}

      <div style={{ padding: '6px 16px 0' }}>
        <div className="radius-chips dradius">
          {[5, 10, 20].map((km) => (
            <div key={km} className={'rchip' + (radius === km ? ' active' : '')} onClick={() => setRadius(km)}>{km} km</div>
          ))}
        </div>
      </div>

      <div className="seclabel" style={{ padding: '10px 16px 10px' }}>
        {queue.length ? queue.length : 'Aucune'} course{queue.length > 1 ? 's' : ''} dans {radius} km
        {available.length > 1 && <span className="batch-hint"> · groupez-les en tournée pour gagner plus</span>}
      </div>

      {sel.size > 0 && (
        <div className="batch-bar">
          <div className="batch-info">
            <strong>Tournée groupée · {sel.size} course{sel.size > 1 ? 's' : ''}</strong>
            <span>~{eur(batchEarn)} estimés (base {COURIER_FEE.toFixed(0)}€ + {COURIER_BATCH_BONUS.toFixed(0)}€/course groupée)</span>
          </div>
          <button className="batch-go" onClick={takeBatch}>Prendre la tournée</button>
        </div>
      )}

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
          const isTrial = partOf(o) === 'trial';
          return (
            <div className={'pickcard' + (isTrial ? ' opp' : '')} key={o.id}>
              <div className="pickhead" style={{ background: meta.color }}>
                <span>{meta.emoji} {o.shopName.length > 18 ? o.shopName.slice(0, 18) + '…' : o.shopName} {isTrial && <span className="opp-chip">✨ Essai</span>}</span>
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
                    <>
                      <button className={'btngroup' + (sel.has(o.id) ? ' on' : '')} onClick={() => toggleSel(o.id)} title="Ajouter à une tournée groupée">
                        <i className={'ti ' + (sel.has(o.id) ? 'ti-check' : 'ti-plus')} /> Tournée
                      </button>
                      <button className="btnacc" onClick={() => take(o)}><i className="ti ti-check" /> Prendre</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ height: 16 }} />
      </div>
      {showHow && <HowItWorks role="livreur" onClose={() => setShowHow(false)} />}
    </div>
  );
}
