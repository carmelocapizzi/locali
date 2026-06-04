import { useEffect, useState } from 'react';

function fmt() {
  const n = new Date();
  return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

export default function StatusBar() {
  const [clock, setClock] = useState(fmt());
  useEffect(() => {
    const t = setInterval(() => setClock(fmt()), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="statusbar">
      <span className="time">{clock}</span>
      <div className="icons"><i className="ti ti-wifi" /><i className="ti ti-battery" /></div>
    </div>
  );
}
