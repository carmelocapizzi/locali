import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const LABELS = { client: 'Client', commercant: 'Commerçant', livreur: 'Livreur' };

function fmt() {
  const n = new Date();
  return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

export default function StatusBar() {
  const { user, logout } = useAuth();
  const [clock, setClock] = useState(fmt());

  useEffect(() => {
    const t = setInterval(() => setClock(fmt()), 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="statusbar">
      <span className="time">{clock}</span>
      <button className="role-chip" onClick={logout} title="Se déconnecter">
        👤 {LABELS[user.role]} <i className="ti ti-logout" />
      </button>
    </div>
  );
}
