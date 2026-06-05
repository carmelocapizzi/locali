import { useEffect, useMemo, useState } from 'react';
import { useLocali } from '../../context/LocaliContext';
import { useUI } from '../../context/UIContext';
import { buildMarkets } from '../../utils/markets';
import { buildEvents } from '../../utils/events';

const AKEY = 'locali.marketAlerts';
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function loadAlerts() {
  try { const r = localStorage.getItem(AKEY); return r ? JSON.parse(r) : []; } catch (e) { return []; }
}

export default function Markets() {
  const { lat, lon, status, extEvents, osmMarkets, radiusKm, setRadiusKm } = useLocali();
  const { toast } = useUI();
  const [alerts, setAlerts] = useState(loadAlerts);

  // Marchés (récurrents) + événements commerçants + OpenAgenda, dans le rayon choisi
  const items = useMemo(() => {
    const markets = buildMarkets(lat, lon, osmMarkets, radiusKm).map((m) => ({
      id: m.id, kind: 'market', title: m.name,
      sub: `${m.dayName}${m.time ? ' · ' + m.time : ''}`, place: m.place || m.commune,
      distStr: m.distStr, date: m.date, today: m.today, typeLabel: 'Marché',
    }));
    const ev = [...buildEvents(lat, lon, radiusKm), ...extEvents.filter((e) => e.dist == null || e.dist <= radiusKm * 1000)];
    const events = ev.map((e) => ({
      id: e.id, kind: 'event', title: e.title,
      sub: e.source === 'openagenda' ? 'OpenAgenda' : e.type, place: e.place, distStr: e.distStr,
      date: e.dateObj, today: e.today, typeLabel: e.type,
    }));
    return [...markets, ...events].sort((a, b) => {
      const da = a.date ? a.date.getTime() : Infinity;
      const db = b.date ? b.date.getTime() : Infinity;
      if (da !== db) return da - db;
      return 0;
    });
  }, [lat, lon, osmMarkets, extEvents, radiusKm]);

  useEffect(() => {
    try { localStorage.setItem(AKEY, JSON.stringify(alerts)); } catch (e) {}
  }, [alerts]);

  // Rappel local : notifie les éléments suivis qui ont lieu aujourd'hui
  useEffect(() => {
    const todays = items.filter((m) => m.today && alerts.includes(m.id));
    if (todays.length && 'Notification' in window && Notification.permission === 'granted') {
      todays.forEach((m) => {
        try { new Notification('📣 ' + m.title + " aujourd'hui", { body: m.sub + (m.place ? ' · ' + m.place : '') }); } catch (e) {}
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

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

  const todays = items.filter((m) => m.today);

  return (
    <div className="sc-markets">
      <div className="markhead">
        <h2>Marchés &amp; événements</h2>
        <p>Dans un rayon de {radiusKm} km autour de vous · alerte 🔔 possible</p>
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

      <div className="mark-list">
        {items.length === 0 && (
          <div className="empty-mini">
            {status === 'ready' ? 'Aucun marché ni événement dans votre zone.' : 'Localisation en cours…'}
          </div>
        )}
        {items.map((m) => {
          const on = alerts.includes(m.id);
          const evt = m.kind === 'event';
          return (
            <div className={'markcard' + (m.today ? ' today' : '')} key={m.id}>
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
              <button className={'bell' + (on ? ' on' : '')} onClick={() => toggleAlert(m)} title="Alerte">
                <i className={'ti ' + (on ? 'ti-bell-filled' : 'ti-bell')} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mark-note">
        Marchés : sources communales + marches-de-belgique.be. Événements : publiés par les
        commerçants locaux. (Une source ouverte type OpenAgenda peut être ajoutée pour les compléter.)
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}
