import { useMemo, useState } from 'react';
import { useLocali } from '../../context/LocaliContext';
import { useUI } from '../../context/UIContext';
import { getMeta } from '../../utils/overpass';
import { catalogForType } from '../../utils/products';

const TIMES = ['10h30', '11h00', '11h45', '12h30', '13h15', '14h00'];
const GAINS = ['2,50€', '2,50€', '3,00€', '3,00€', '3,50€', '3,50€'];
const PICK_TYPES = ['bakery', 'farm', 'butcher', 'cheese', 'greengrocer'];

export default function Delivery() {
  const { shops } = useLocali();
  const { toast } = useUI();
  const [radius, setRadius] = useState(5);
  const [accepted, setAccepted] = useState({});

  const pickups = useMemo(
    () => shops.filter((s) => s.dist <= radius * 1000 && PICK_TYPES.includes(s.type)).slice(0, 6),
    [shops, radius]
  );

  const accept = (id, name) => {
    setAccepted((a) => ({ ...a, [id]: true }));
    toast('Course acceptée 🚴 — ' + name.slice(0, 20));
  };

  return (
    <div className="sc-delivery">
      <div className="dhead">
        <h2>Espace Livreur</h2>
        <p>Courses disponibles près de vous</p>
        <div className="online-dot">
          <div className="dot-pulse" />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>En ligne</span>
        </div>
      </div>

      <div className="dstatwrap">
        <div className="dstat"><div className="val">6</div><div className="lbl">Courses aujourd'hui</div></div>
        <div className="dstat"><div className="val">14,80€</div><div className="lbl">Gains du jour</div></div>
        <div className="dstat"><div className="val">4.9★</div><div className="lbl">Ma note</div></div>
      </div>

      <div style={{ padding: '6px 16px 0' }}>
        <div className="radius-chips dradius">
          {[3, 5, 10].map((km) => (
            <div key={km} className={'rchip' + (radius === km ? ' active' : '')} onClick={() => setRadius(km)}>
              {km} km
            </div>
          ))}
        </div>
      </div>

      <div className="seclabel" style={{ padding: '10px 16px 10px' }}>
        {pickups.length ? pickups.length : 'Aucune'} collecte{pickups.length > 1 ? 's' : ''} dans {radius} km
      </div>

      <div>
        {pickups.length === 0 && (
          <div className="empty-mini">Aucune course disponible dans ce rayon.<br />Élargissez votre rayon d'action.</div>
        )}
        {pickups.map((s, i) => {
          const meta = getMeta(s.type);
          const isAcc = accepted[s.id];
          return (
            <div className="pickcard" key={s.id} style={{ opacity: isAcc ? 0.55 : 1 }}>
              <div className="pickhead" style={{ background: meta.color }}>
                <span>{meta.emoji} {s.name.length > 22 ? s.name.slice(0, 22) + '…' : s.name}</span>
                <span className="picktime"><i className="ti ti-clock" style={{ fontSize: 10 }} /> avant {TIMES[i]}</span>
              </div>
              <div className="pickbody">
                <div className="pickshop">Commande #LCL-{2847 + i}</div>
                <div className="pickaddr"><i className="ti ti-map-pin" style={{ fontSize: 12 }} /> {s.addr || s.distStr + ' de vous'}</div>
                <div className="pickitems">
                  {catalogForType(s.type).slice(0, 2).map((p) => p.e + ' ' + p.n).join(' · ')}
                  <br /><strong>→ Livrer à :</strong> Adresse client Locali · {GAINS[i]} crédités
                </div>
                <div className="pickactions">
                  <button className="btnmap" onClick={() => toast('Navigation GPS lancée 🗺️')}>
                    <i className="ti ti-map" /> Itinéraire
                  </button>
                  <button className="btnacc" disabled={isAcc} style={isAcc ? { background: '#888' } : null} onClick={() => accept(s.id, s.name)}>
                    <i className="ti ti-check" /> {isAcc ? 'Acceptée !' : 'Accepter'}
                  </button>
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
