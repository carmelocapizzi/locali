// ─── Analyse des horaires OSM (opening_hours) ───────────

export function isOpenNow(oh) {
  if (!oh) return null;
  if (/24\/7/.test(oh)) return true;
  try {
    const now = new Date();
    const dayCode = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][now.getDay()];
    const mins = now.getHours() * 60 + now.getMinutes();
    const rules = oh.split(';').map((r) => r.trim()).filter(Boolean);
    let matchedAny = false;
    for (const rule of rules) {
      const m = rule.match(/^([A-Za-z,\-\s]*?)\s*([0-9:,\-\s]+)$/);
      if (!m) continue;
      const days = parseDays(m[1].trim());
      if (days && !days.has(dayCode)) continue;
      const ranges = m[2].trim().split(',').map((t) => t.trim());
      for (const rg of ranges) {
        const tm = rg.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (!tm) continue;
        matchedAny = true;
        const start = +tm[1] * 60 + +tm[2];
        let end = +tm[3] * 60 + +tm[4];
        if (end <= start) end += 24 * 60; // horaire de nuit
        let cur = mins;
        if (cur < start && end > 24 * 60) cur += 24 * 60;
        if (cur >= start && cur < end) return true;
      }
    }
    return matchedAny ? false : null;
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

// Retourne la pastille (classe CSS + libellé) selon l'état d'ouverture
export function statusInfo(oh) {
  const o = isOpenNow(oh);
  if (o === true) return { cls: 'pill-open', label: 'Ouvert' };
  if (o === false) return { cls: 'pill-closed', label: 'Fermé' };
  return { cls: 'pill-unknown', label: 'Horaires ?' };
}
