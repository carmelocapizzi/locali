import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

const LABELS = { client: 'Client', commercant: 'Commerçant', livreur: 'Livreur' };
const EMO = { client: '🛒', commercant: '🏪', livreur: '🚴' };

export default function TopBar() {
  const { user, switchRole, logout } = useAuth();
  const { back, canGoBack } = useUI();
  const [open, setOpen] = useState(false);
  const pick = (role) => { setOpen(false); switchRole(role); };

  return (
    <div className="topbar">
      <button className="tb-back" onClick={back} disabled={!canGoBack} aria-label="Retour">
        <i className="ti ti-arrow-left" />{canGoBack ? <span>Retour</span> : null}
      </button>
      <div className="tb-logo">🌿 Locali</div>
      <div className="role-switch">
        <button className="tb-profile" onClick={() => setOpen((o) => !o)} title="Changer de profil">
          {EMO[user.role]} <span>{LABELS[user.role]}</span> <i className="ti ti-chevron-down" />
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
