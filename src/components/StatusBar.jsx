import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const LABELS = { client: 'Client', commercant: 'Commerçant', livreur: 'Livreur' };
const EMO = { client: '🛒', commercant: '🏪', livreur: '🚴' };

function fmt() {
  const n = new Date();
  return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

export default function StatusBar() {
  const { user, switchRole, logout } = useAuth();
  const [clock, setClock] = useState(fmt());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setClock(fmt()), 15000);
    return () => clearInterval(t);
  }, []);

  const pick = (role) => { setOpen(false); switchRole(role); };

  return (
    <div className="statusbar">
      <span className="time">{clock}</span>
      <div className="role-switch">
        <button className="role-chip" onClick={() => setOpen((o) => !o)} title="Changer de profil">
          {EMO[user.role]} {LABELS[user.role]} <i className="ti ti-chevron-down" />
        </button>
        {open && (
          <>
            <div className="role-backdrop" onClick={() => setOpen(false)} />
            <div className="role-menu">
              <div className="role-menu-h">Tout le monde peut l'être</div>
              <button className={'rm-item' + (user.role === 'client' ? ' on' : '')} onClick={() => pick('client')}>🛒 Client</button>
              <button className={'rm-item' + (user.role === 'livreur' ? ' on' : '')} onClick={() => pick('livreur')}>🚴 Livreur</button>
              <div className="role-menu-h">Réservé aux commerçants</div>
              <button className={'rm-item' + (user.role === 'commercant' ? ' on' : '')} onClick={() => pick('commercant')}>🏪 Espace commerçant</button>
              <button className="rm-out" onClick={() => { setOpen(false); logout(); }}><i className="ti ti-logout" /> Se déconnecter</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
