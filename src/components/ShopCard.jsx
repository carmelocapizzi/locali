import { getMeta } from '../utils/overpass';
import { statusInfo } from '../utils/hours';
import { participationOf } from '../utils/participation';

export default function ShopCard({ shop, onClick }) {
  const meta = getMeta(shop.type);
  const st = statusInfo(shop.hours);
  const part = participationOf(shop.id);
  return (
    <div className="shopcard" onClick={onClick}>
      <div className="shopthumb" style={{ background: meta.bg }}>{meta.emoji}</div>
      <div className="shopinfo">
        <div className="shopname" title={shop.name}>{shop.name}</div>
        <div className="shopmeta">{meta.label} · {shop.distStr}</div>
        <div className="shopmeta" style={{ marginTop: 5, gap: 5 }}>
          <span className={'pill ' + st.cls}>{st.label}</span>
          {part === 'subscribed' && <span className="pill pill-abo">Locali ✓</span>}
          {part === 'trial' && <span className="pill" style={{ background: '#e3f0fb', color: '#1a5a8a' }}>Essai Locali</span>}
        </div>
      </div>
    </div>
  );
}
