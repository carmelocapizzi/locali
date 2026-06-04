import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useLocali } from '../../context/LocaliContext';
import { useUI } from '../../context/UIContext';
import { useAuth } from '../../context/AuthContext';
import { getMeta } from '../../utils/overpass';
import { isOpenNow } from '../../utils/hours';
import { MAP_FILTERS } from '../../data/constants';
import { loadParticipants, participationOf } from '../../utils/participation';

const STATUS_TXT = { subscribed: 'Abonné Locali ✓', trial: 'En essai Locali', none: 'Non participant' };

export default function MapScreen() {
  const { lat, lon, shops } = useLocali();
  const { openShop } = useUI();
  const { user } = useAuth();
  const isCourier = user.role === 'livreur';
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const participants = loadParticipants();

  const filtered = useMemo(() => {
    let base = filter === 'all' ? shops : shops.filter((s) => s.type === filter);
    const t = q.trim().toLowerCase();
    if (t) base = base.filter((s) => s.name.toLowerCase().includes(t) || getMeta(s.type).label.toLowerCase().includes(t));
    // Vue livreur : uniquement les commerces participants ou en essai
    if (isCourier) base = base.filter((s) => participationOf(s.id, participants) !== 'none');
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shops, filter, q, isCourier]);

  useEffect(() => {
    if (lat == null || !mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: false }).setView([lat, lon], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(map);
    L.marker([lat, lon], { icon: L.divIcon({ html: '<div class="shop-pin">📍</div>', className: '', iconSize: [34, 34], iconAnchor: [17, 30] }) }).addTo(map).bindPopup('Vous êtes ici');
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 120);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, [lat, lon]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    filtered.slice(0, 120).forEach((s) => {
      const meta = getMeta(s.type);
      const status = participationOf(s.id, participants);
      const color = status === 'subscribed' ? meta.color : status === 'trial' ? '#2980b9' : '#b9b3a6';
      const cls = status === 'none' ? 'pin-none' : status === 'trial' ? 'pin-trial' : 'pin-sub';
      const icon = L.divIcon({
        html: `<div class="map-pin ${cls}" style="--c:${color}"><span>${meta.emoji}</span></div>`,
        className: '', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28],
      });
      const o = isOpenNow(s.hours);
      const st = o === true ? '<span style="color:#2d7a0a">● Ouvert</span>' : o === false ? '<span style="color:#b93020">● Fermé</span>' : '';
      const part = status === 'subscribed' ? '🟢 Abonné Locali' : status === 'trial' ? '🔵 En essai' : '⚪ Non participant';
      L.marker([s.lat, s.lon], { icon }).addTo(layer)
        .bindPopup(`<b>${s.name}</b><br>${meta.label} · ${s.distStr}<br>${part}${st ? '<br>' + st : ''}`)
        .on('click', () => openShop(s));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, openShop]);

  const center = () => { if (mapRef.current && lat != null) mapRef.current.setView([lat, lon], 14); };

  return (
    <div className="sc-map">
      <div className="mapwrap">
        <div id="leaflet-map" ref={mapEl} />
        <div className="meover">
          <i className="ti ti-search" style={{ color: '#ccc', fontSize: 17 }} />
          <input type="text" placeholder="Chercher sur la carte…" value={q} onChange={(e) => setQ(e.target.value)} />
          <i className="ti ti-focus-2" style={{ color: 'var(--g4)', fontSize: 18, cursor: 'pointer' }} onClick={center} title="Ma position" />
        </div>
        <div className="mefilters">
          {MAP_FILTERS.map((f) => (
            <div key={f.key} className={'mefpill' + (filter === f.key ? ' active' : '')} onClick={() => setFilter(f.key)}>{f.label}</div>
          ))}
        </div>
      </div>

      <div className="map-legend">
        <span><i className="ldot ldot-sub" /> Abonné</span>
        <span><i className="ldot ldot-trial" /> Essai</span>
        <span><i className="ldot ldot-none" /> Non participant</span>
      </div>

      <div className="maplist">
        <div className="seclabel">
          {isCourier ? 'Commerces participants — ' : ''}{filtered.length} commerce{filtered.length > 1 ? 's' : ''}
        </div>
        {isCourier && filtered.length === 0 && (
          <div className="empty-mini">Aucun commerce participant dans cette zone pour l'instant.</div>
        )}
        {filtered.slice(0, 30).map((s) => {
          const meta = getMeta(s.type);
          const status = participationOf(s.id, participants);
          return (
            <div className={'mapitem' + (status === 'none' ? ' mapitem-none' : '')} key={s.id} onClick={() => openShop(s)}>
              <div className="mapicon" style={{ background: meta.bg }}>{meta.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mapitemname">{s.name}</div>
                <div className="mapitemsub">{s.distStr} · {meta.label} · {STATUS_TXT[status]}</div>
              </div>
              <i className="ti ti-chevron-right" style={{ color: '#ddd', fontSize: 18, flexShrink: 0 }} />
            </div>
          );
        })}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
