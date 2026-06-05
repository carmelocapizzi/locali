import { useMemo, useState } from 'react';
import { useLocali } from '../../context/LocaliContext';
import { useUI } from '../../context/UIContext';
import { CATEGORIES } from '../../data/constants';
import { getMeta } from '../../utils/overpass';
import { findProducts } from '../../utils/products';
import { buildMarkets } from '../../utils/markets';
import { buildEvents } from '../../utils/events';
import ShopCard from '../ShopCard';
import HowItWorks from '../HowItWorks';

export default function Home() {
  const { lat, lon, city, shops, status, geo, geoMsg, extEvents, osmMarkets, radiusKm, setRadiusKm, retry, locate, setPlace } = useLocali();
  const { openShop, setScreen } = useUI();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [locInput, setLocInput] = useState('');
  const [showHow, setShowHow] = useState(false);

  const filtered = useMemo(() => {
    let base = cat === 'all' ? shops : shops.filter((s) => s.type === cat);
    const t = q.trim().toLowerCase();
    if (t) base = base.filter((s) => s.name.toLowerCase().includes(t) || getMeta(s.type).label.toLowerCase().includes(t));
    return base.slice(0, 24);
  }, [shops, cat, q]);

  // "Où trouver tel article ?" — produits du catalogue correspondant à la recherche
  const matched = useMemo(() => findProducts(q), [q]);
  const findHere = (type) => { setCat(type); setQ(''); };

  // Marchés + événements près de vous (teaser → onglet Agenda)
  const markets = useMemo(() => {
    const mk = buildMarkets(lat, lon, osmMarkets, radiusKm).map((m) => ({
      id: m.id, name: m.name, date: m.date, today: m.today,
      sub: `${m.dayName}${m.time ? ' · ' + m.time : ''}`, distStr: m.distStr,
    }));
    const evSrc = [...buildEvents(lat, lon, radiusKm), ...extEvents.filter((e) => e.dist == null || e.dist <= radiusKm * 1000)];
    const ev = evSrc.map((e) => ({
      id: e.id, name: e.title, date: e.dateObj, today: e.today,
      sub: e.source === 'openagenda' ? 'OpenAgenda' : e.type, distStr: e.distStr,
    }));
    return [...mk, ...ev]
      .sort((a, b) => (a.date ? a.date.getTime() : Infinity) - (b.date ? b.date.getTime() : Infinity))
      .slice(0, 6);
  }, [lat, lon, osmMarkets, extEvents, radiusKm]);

  const countTxt =
    status === 'ready'
      ? `${shops.length} commerces locaux dans un rayon de ${radiusKm} km`
      : status === 'error'
      ? 'Chargement impossible'
      : status === 'loading'
      ? 'Recherche des commerces locaux…'
      : 'Localisation en cours…';

  return (
    <div className="sc-home">
      <div className="hero">
        <div className="hero-loc">
          <i className="ti ti-map-pin" style={{ fontSize: 13 }} />
          <span>{city}</span>
          <button className="relocate-btn" onClick={locate} title="Utiliser le GPS de l'appareil" disabled={geo === 'locating'}>
            <i className="ti ti-current-location" /> {geo === 'locating' ? 'Localisation…' : 'Charger ma position'}
          </button>
        </div>

        {(geo === 'fallback' || geoMsg) && (
          <div className="loc-panel">
            {geoMsg && <div className="loc-msg">{geoMsg}</div>}
            <form
              className="loc-form"
              onSubmit={(e) => { e.preventDefault(); if (locInput.trim()) setPlace(locInput); }}
            >
              <input
                type="text"
                placeholder="Sinon, entrez votre commune ou code postal (ex. Namur, 5000)"
                value={locInput}
                onChange={(e) => setLocInput(e.target.value)}
              />
              <button type="submit" title="Valider"><i className="ti ti-arrow-right" /></button>
            </form>
          </div>
        )}
        <div className="hero-title">Bonjour,<br /><em>que cherchez-vous ?</em></div>
        <div className="hero-count">{countTxt}</div>
        <button className="howlink" onClick={() => setShowHow(true)}>💡 Livraison offerte : comment ça marche ?</button>
        <div className="searchbar">
          <i className="ti ti-search" style={{ color: '#ccc', fontSize: 18 }} />
          <input
            type="text"
            placeholder="Boulangerie, marché, ferme…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="sec-title">Catégories</div>
      <div className="cats">
        {CATEGORIES.map((c) => (
          <div
            key={c.key}
            className={'cat' + (cat === c.key ? ' active' : '')}
            onClick={() => setCat(c.key)}
          >
            <div className="cat-icon" style={{ background: c.bg }}>{c.emoji}</div>
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      {q.trim() && matched.length > 0 && (
        <div className="find-strip">
          <div className="find-title"><i className="ti ti-search" /> Où trouver « {q.trim()} » ?</div>
          {matched.slice(0, 4).map((p, i) => (
            <div className="find-row" key={i}>
              <span className="find-prod">{p.e} {p.n}</span>
              <div className="find-where">
                {p.sells.map((type) => (
                  <button key={type} className="find-chip" onClick={() => findHere(type)}>
                    {getMeta(type).emoji} {getMeta(type).label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="sec-title">Près de vous</div>
      <div style={{ padding: '0 22px 8px' }}>
        <div className="radius-chips">
          {[5, 10, 20].map((km) => (
            <div key={km} className={'rchip' + (radiusKm === km ? ' active' : '')} onClick={() => setRadiusKm(km)}>{km} km</div>
          ))}
        </div>
      </div>

      {(status === 'locating' || status === 'loading') && (
        <div className="hscroll">
          {[0, 1, 2, 3].map((i) => (
            <div className="shopcard" key={i}>
              <div className="shopthumb skel" />
              <div className="shopinfo">
                <div className="skel" style={{ height: 12, width: '75%', borderRadius: 6, marginBottom: 8 }} />
                <div className="skel" style={{ height: 10, width: '50%', borderRadius: 6, marginBottom: 8 }} />
                <div className="skel" style={{ height: 14, width: '60%', borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="loading-state">
          <i className="ti ti-wifi-off" style={{ fontSize: 34, color: '#ccc' }} />
          <p>Impossible de charger les commerces.<br />Vérifiez votre connexion.</p>
          <button className="retry-btn" onClick={retry}>Réessayer</button>
        </div>
      )}

      {status === 'ready' && (
        <div className="hscroll">
          {filtered.length ? (
            filtered.map((s) => <ShopCard key={s.id} shop={s} onClick={() => openShop(s)} />)
          ) : (
            <div className="empty-mini" style={{ flexShrink: 0 }}>Aucun commerce dans cette sélection</div>
          )}
        </div>
      )}

      <div className="sec-title" style={{ marginTop: 8 }}>
        Marchés &amp; événements
        <a onClick={() => setScreen('markets')}>tout voir →</a>
      </div>
      <div className="hscroll">
        {markets.length > 0 ? (
          markets.map((m) => (
            <AgendaCard
              key={m.id}
              day={m.date ? m.date.getDate() : '•'}
              mois={m.date ? ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][m.date.getMonth()] : '—'}
              color={m.today ? 'var(--amber)' : 'var(--g4)'}
              title={m.name}
              place={`${m.sub}${m.distStr ? ' · ' + m.distStr : ''}`}
              onClick={() => setScreen('markets')}
            />
          ))
        ) : (
          <div className="empty-mini" style={{ flexShrink: 0, width: 300 }}>
            {status === 'ready' ? 'Aucun marché ni événement dans votre zone.' : 'Recherche en cours…'}
          </div>
        )}
      </div>
      <div style={{ height: 20 }} />
      {showHow && <HowItWorks role="client" onClose={() => setShowHow(false)} />}
    </div>
  );
}

function AgendaCard({ day, mois, color, title, place, onClick }) {
  return (
    <div className="agenda-card" onClick={onClick}>
      <div className="agenda-date" style={{ background: color }}>
        <div className="agenda-day">{day}</div>
        <div className="agenda-mois">{mois}</div>
      </div>
      <div className="agenda-info">
        <div className="agenda-title">{title}</div>
        <div className="agenda-place"><i className="ti ti-map-pin" style={{ fontSize: 11 }} /> {place}</div>
      </div>
    </div>
  );
}
