// ─── Agenda local : jours de marché réels (OSM) ─────────
// Construit à partir des amenity=marketplace chargés autour de l'utilisateur,
// en lisant leur opening_hours pour déduire le prochain jour de marché.

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
const CODE = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };

function hm(h, m) {
  return m === '00' ? +h + 'h' : +h + 'h' + m;
}

function expandDays(part) {
  if (!part) return [];
  const order = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const out = [];
  for (const tok of part.split(',').map((t) => t.trim())) {
    const r = tok.match(/([A-Za-z]{2})\s*-\s*([A-Za-z]{2})/);
    if (r) {
      const a = order.indexOf(r[1]);
      const b = order.indexOf(r[2]);
      if (a >= 0 && b >= 0) { let i = a, g = 0; while (g++ < 8) { out.push(CODE[order[i]]); if (i === b) break; i = (i + 1) % 7; } }
    } else if (CODE[tok] !== undefined) {
      out.push(CODE[tok]);
    }
  }
  return out;
}

function parseSlots(oh) {
  if (!oh) return [];
  const slots = [];
  for (const rule of oh.split(';').map((r) => r.trim()).filter(Boolean)) {
    const m = rule.match(/^([A-Za-z,\-\s]*?)\s*([0-9:,\-\s]+)$/);
    if (!m) continue;
    const days = expandDays(m[1].trim());
    const tm = m[2].match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    const label = tm ? hm(tm[1], tm[2]) + '–' + hm(tm[3], tm[4]) : '';
    for (const d of days) slots.push({ day: d, label });
  }
  return slots;
}

function nextDate(dayIdx, now) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (dayIdx - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export function buildAgenda(shops, now = new Date()) {
  const markets = shops.filter((s) => s.type === 'marketplace');
  const items = markets.map((mk) => {
    const slots = parseSlots(mk.hours);
    if (slots.length) {
      let best = null;
      for (const sl of slots) {
        const dt = nextDate(sl.day, now);
        if (!best || dt < best.dt) best = { dt, label: sl.label };
      }
      return {
        name: mk.name, distStr: mk.distStr, addr: mk.addr,
        date: best.dt, dayName: DAY_NAMES[best.dt.getDay()], time: best.label,
      };
    }
    return { name: mk.name, distStr: mk.distStr, addr: mk.addr, date: null, dayName: 'Jour de marché', time: '' };
  });
  items.sort((a, b) => (a.date ? a.date.getTime() : Infinity) - (b.date ? b.date.getTime() : Infinity));
  return items.map((it) => ({
    ...it,
    day: it.date ? it.date.getDate() : '•',
    month: it.date ? MONTHS[it.date.getMonth()] : 'Marché',
  }));
}
