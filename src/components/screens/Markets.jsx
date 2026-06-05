import { useEffect, useMemo, useState } from 'react';
import { useLocali } from '../../context/LocaliContext';
import { useUI } from '../../context/UIContext';
import { buildMarkets } from '../../utils/markets';
import { buildEvents } from '../../utils/events';

const AKEY = 'locali.marketAlerts';
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function loadAlerts() {
  try { const r = localStorage.getItem(AKEY); return r ? JSON.parse(r) : []; } catch (e) { return []; }
}
function fullDate(d) {
  if (!d) return 'Date à confirmer';
  return `${DAYS[d.getDay()]} ${d.getDate()} ${['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][d.getMonth()]}`;
}

export default function Markets() {
  const { lat, lon, status, extEvents, osmMarkets, radiusKm, setRadiusKm, shops } = useLocali();
  const { toast, openShop } = useUI();
  const [alerts, setAlerts] = useState(loadAlerts);
  const [detail, setDetail] = useState(null);

  // Marchés (récurrents) — dans le rayon choisi
  const markets = useMemo(() => buildMarkets(lat, lon, osmMarkets, radiusKm).map((m) => ({
    id: m.id, kind: 'market', title: m.name,
    sub: `${m.dayName}${m.time ? ' · ' + m.time : ''}`, place: m.place || m.commune,
    distStr: m.distStr, date: m.date, today: m.today, typeLabel: 'Marché',
    lat: m.lat, lon: m.lon, curated: m.curated,
  })), [lat, lon, osmMarkets, radiusKm]);

  // Événements communaux + publiés par les commerçants — dans le rayon choisi
  const events = useMemo(() => {
    const ev = [...buildEvents(lat, lon, radiusKm), ...extEvents.filter((e) => e.dist == null || e.dist <= radiusKm * 1000)];
    return ev.map((e) => ({
      id: e.id, kind: 'event', title: e.title,
      sub: e.source === 'openagenda' ? 'OpenAgenda' : e.type, place: e.place, distStr: e.distStr,
      date: e.dateObj, today: e.today, typeLabel: e.type || 'Événement',
      lat: e.lat, lon: e.lon, source: e.source, shopId: e.shopId, shopName: e.shopName, shopType: e.shopType,
    })).sort((a, b) => (a.date ? a.date.getTime() : Infinity) - (b.date ? b.date.getTime() : Infinity));
  }, [lat, lon, extEvents, radiusKm]);

  const all = useMemo(() => [...markets, ...events], [markets, events]);

  useEffect(() => {
    try { localStorage.setItem(AKEY, JSON.stringify(alerts)); } catch (e) {}
  }, [alerts]);

  // Rappel local : notifie les éléments suivis qui ont lieu aujourd'hui
  useEffect(() => {
    const todays = all.filter((m) => m.today && alerts.includes(m.id));
    if (todays.length && 'Notification' in window && Notification.permission === 'granted') {
      todays.forEach((m) => {
        try { new Notification('📣 ' + m.title + " aujourd'hui", { body: m.sub + (m.place ? ' · ' + m.place : '') }); } catch (e) {}
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  const toggleAlert = (m) => {
    if (alerts.includes(m.id)) {
      setAlerts((a) => a.filter((x) => x !== m.id));
      toast('Alerte désactivée');
    } else {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      setAlerts((a) => [...a, m.id]);
      toast('🔔 Alerte activée — ' + m.title);
    }
  };

  const seeMerchant = (item) => {
    const sh = (shops || []).find((s) => s.id === item.shopId);
    if (sh) { setDetail(null); openShop(sh); }
    else toast('Commerçant : ' + (item.shopName || '—') + ' (hors de votre rayon actuel)');
  };

  const todays = all.filter((m) => m.today);

  return (
    <div className="sc-markets">
      <div className="markhead">
        <h2>Marchés &amp; événements</h2>
        <p>Autour de vous · cliquez pour la fiche détaillée · alerte 🔔 possible</p>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        <div className="radius-chips">
          {[5, 10, 20].map((km) => (
            <div key={km} className={'rchip' + (radiusKm === km ? ' active' : '')} onClick={() => setRadiusKm(km)}>{km} km</div>
          ))}
        </div>
      </div>

      {todays.length > 0 && (
        <div className="mark-today">
          <i className="ti ti-calendar-event" /> Aujourd'hui : {todays.map((m) => m.title).join(' · ')}
        </div>
      )}

      <Section title="🧺 Marchés" empty="Aucun marché dans votre zone." status={status}
        items={markets} alerts={alerts} onOpen={setDetail} onAlert={toggleAlert} />

      <Section title="🎉 Événements" empty="Aucun événement annoncé dans votre zone." status={status}
        items={events} alerts={alerts} onOpen={setDetail} onAlert={toggleAlert} />

      <div className="mark-note">
        Marchés : sources communales + marches-de-belgique.be. Événements : communaux et publiés
        par les commerçants locaux. Cliquez un élément pour la fiche, l'itinéraire et la recherche web.
      </div>
      <div style={{ height: 16 }} />

      {detail && (
        <AgendaDetail
          item={detail}
          alertOn={alerts.includes(detail.id)}
          onAlert={() => toggleAlert(detail)}
          onSeeMerchant={() => seeMerchant(detail)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function Section({ title, empty, status, items, alerts, onOpen, onAlert }) {
  return (
    <>
      <div className="agenda-sec-title">{title} <span className="agenda-sec-count">{items.length}</span></div>
      <div className="mark-list">
        {items.length === 0 && (
          <div className="empty-mini">{status === 'ready' ? empty : 'Localisation en cours…'}</div>
        )}
        {items.map((m) => {
          const on = alerts.includes(m.id);
          const evt = m.kind === 'event';
          return (
            <div className={'markcard clickable' + (m.today ? ' today' : '')} key={m.id} onClick={() => onOpen(m)}>
              <div className={'markdate' + (evt && !m.today ? ' event' : '')}>
                {m.date ? (
                  <>
                    <div className="markday">{m.date.getDate()}</div>
                    <div className="markmon">{MONTHS[m.date.getMonth()]}</div>
                  </>
                ) : (
                  <div className="markmon" style={{ fontSize: 20 }}>🧺</div>
                )}
              </div>
              <div className="markinfo">
                <div className="markname">
                  {m.title}
                  {m.today && <span className="badge-today">Aujourd'hui</span>}
                </div>
                <div className="marksub">
                  <span className={'mark-type' + (evt ? ' evt' : '')}>{m.typeLabel}</span>
                  {m.sub}
                </div>
                <div className="markplace">
                  <i className="ti ti-map-pin" style={{ fontSize: 12 }} /> {m.place || '—'}{m.distStr ? ' · ' + m.distStr : ''}
                </div>
              </div>
              <button className={'bell' + (on ? ' on' : '')} onClick={(e) => { e.stopPropagation(); onAlert(m); }} title="Alerte">
                <i className={'ti ' + (on ? 'ti-bell-filled' : 'ti-bell')} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AgendaDetail({ item, alertOn, onAlert, onSeeMerchant, onClose }) {
  const mapsUrl = item.lat != null
    ? `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.title + ' ' + (item.place || ''))}`;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(item.title + ' ' + (item.place || '') + ' Belgique')}`;
  const isMerchant = item.kind === 'event' && item.source === 'merchant';

  return (
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="ad-close" onClick={onClose}><i className="ti ti-x" /></button>
        <div className="ad-kind">{item.kind === 'market' ? '🧺 Marché' : '🎉 ' + (item.typeLabel || 'Événement')}</div>
        <h3 className="ad-title">{item.title}</h3>

        <div className="ad-row"><i className="ti ti-calendar" /> {fullDate(item.date)}{item.today && <span className="badge-today">Aujourd'hui</span>}</div>
        {item.sub && <div className="ad-row"><i className="ti ti-clock" /> {item.sub}</div>}
        <div className="ad-row"><i className="ti ti-map-pin" /> {item.place || 'Lieu à confirmer'}{item.distStr ? ' · ' + item.distStr : ''}</div>
        {item.kind === 'market' && (
          <div className="ad-note">{item.curated ? 'Marché récurrent (jours/heures vérifiés).' : 'Marché référencé sur OpenStreetMap.'}</div>
        )}
        {isMerchant && item.shopName && (
          <div className="ad-organizer">
            <span>Organisé par <strong>{item.shopName}</strong></span>
            <button className="ad-merchant-btn" onClick={onSeeMerchant}>Voir le commerçant →</button>
          </div>
        )}

        <div className="ad-actions">
          <a className="ad-btn primary" href={mapsUrl} target="_blank" rel="noopener noreferrer"><i className="ti ti-map-2" /> Itinéraire</a>
          <a className="ad-btn" href={searchUrl} target="_blank" rel="noopener noreferrer"><i className="ti ti-brand-google" /> Plus d'infos</a>
          <button className={'ad-btn' + (alertOn ? ' on' : '')} onClick={onAlert}>
            <i className={'ti ' + (alertOn ? 'ti-bell-filled' : 'ti-bell')} /> {alertOn ? 'Suivi' : 'M\'alerter'}
          </button>
        </div>
      </div>
    </div>
  );
}
