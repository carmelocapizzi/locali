// ─── Analyse des horaires OSM (opening_hours) ───────────

const DAY_ORDER = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_FR = { Mo: 'Lun', Tu: 'Mar', We: 'Mer', Th: 'Jeu', Fr: 'Ven', Sa: 'Sam', Su: 'Dim' };

export function isOpenNow(oh) {
  if (!oh) return null;
  if (/24\/7/.test(oh)) return true;
  try {
    const now = new Date();
    const dayCode = DAY_ORDER[now.getDay()];
    const mins = now.getHours() * 60 + now.getMinutes();
    const rules = oh.split(';').map((r) => r.trim()).filter(Boolean);
    let parsed = false; // au moins une plage horaire exploitable dans toute la chaîne
    let open = false;
    for (const rule of rules) {
      const m = rule.match(/^([A-Za-z,\-\s]*?)\s*([0-9:,\-\s]+)$/);
      if (!m) continue; // ex. "Su off" : ignoré
      const days = parseDays(m[1].trim());
      const ranges = m[2].trim().split(',').map((t) => t.trim());
      for (const rg of ranges) {
        const tm = rg.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (!tm) continue;
        parsed = true;
        if (days && !days.has(dayCode)) continue; // règle pas valable aujourd'hui
        const start = +tm[1] * 60 + +tm[2];
        let end = +tm[3] * 60 + +tm[4];
        if (end <= start) end += 24 * 60; // horaire de nuit
        let cur = mins;
        if (cur < start && end > 24 * 60) cur += 24 * 60;
        if (cur >= start && cur < end) open = true;
      }
    }
    if (open) return true;
    return parsed ? false : null; // parsable mais fermé maintenant → false ; sinon inconnu
  } catch (e) {
    return null;
  }
}

function parseDays(dayPart) {
  if (!dayPart) return null; // tous les jours
  const order = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const set = new Set();
  for (const tok of dayPart.split(',').map((t) => t.trim())) {
    const range = tok.match(/([A-Za-z]{2})\s*-\s*([A-Za-z]{2})/);
    if (range) {
      const a = order.indexOf(range[1]);
      const b = order.indexOf(range[2]);
      if (a >= 0 && b >= 0) {
        let i = a, guard = 0;
        while (guard++ < 8) { set.add(order[i]); if (i === b) break; i = (i + 1) % 7; }
      }
    } else if (order.includes(tok)) {
      set.add(tok);
    }
  }
  return set.size ? set : null;
}

// Pastille (classe CSS + libellé) selon l'état d'ouverture
export function statusInfo(oh) {
  const o = isOpenNow(oh);
  if (o === true) return { cls: 'pill-open', label: 'Ouvert' };
  if (o === false) return { cls: 'pill-closed', label: 'Fermé' };
  return { cls: 'pill-unknown', label: 'Horaires ?' };
}

// ── Mise en forme lisible des horaires OSM (français) ──
function fmtT(h, m) { return m === '00' ? h + 'h' : h + 'h' + m; }

function readableDays(dayPart) {
  if (!dayPart) return 'Tous les jours';
  return dayPart.split(',').map((t) => t.trim()).map((tok) => {
    const r = tok.match(/([A-Za-z]{2})\s*-\s*([A-Za-z]{2})/);
    if (r) return (DAY_FR[r[1]] || r[1]) + '–' + (DAY_FR[r[2]] || r[2]);
    return DAY_FR[tok] || tok;
  }).join(', ');
}

export function formatHours(oh) {
  if (!oh) return null;
  if (/24\/7/.test(oh)) return '24h/24, 7j/7';
  try {
    const out = [];
    let ok = false;
    for (const rule of oh.split(';').map((r) => r.trim()).filter(Boolean)) {
      const m = rule.match(/^([A-Za-z][A-Za-z,\-\s]*?)\s+(.*)$/) || [null, '', rule];
      const dayLabel = readableDays((m[1] || '').trim());
      const rest = (m[2] || '').trim();
      let timeLabel;
      if (/off|closed|fermé/i.test(rest)) {
        timeLabel = 'fermé';
      } else {
        const ranges = rest.split(',').map((t) => t.trim()).map((rg) => {
          const tm = rg.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
          return tm ? fmtT(+tm[1], tm[2]) + '–' + fmtT(+tm[3], tm[4]) : null;
        }).filter(Boolean);
        if (!ranges.length) continue;
        timeLabel = ranges.join(', ');
      }
      ok = true;
      out.push(dayLabel + ' : ' + timeLabel);
    }
    return ok ? out.join(' · ') : oh; // si non parsable, on montre la chaîne brute
  } catch (e) {
    return oh;
  }
}
