import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../data/constants';

export default function Login() {
  const { login } = useAuth();
  const [role, setRole] = useState(null);
  const [name, setName] = useState('');

  return (
    <div className="frame login-frame">
      <div className="login-hero">
        <div className="login-logo">🌿 Locali</div>
        <h1>Commerces réels<br /><em>près de chez vous</em></h1>
        <p>Connectez-vous pour continuer</p>
      </div>

      <div className="login-body">
        <input
          className="login-input"
          type="text"
          placeholder="Votre prénom (optionnel)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="role-label">Je me connecte en tant que</div>
        <div className="role-cards">
          {ROLES.map((r) => (
            <button
              key={r.key}
              className={'role-card' + (role === r.key ? ' active' : '')}
              onClick={() => setRole(r.key)}
            >
              <div className="role-emoji">{r.emoji}</div>
              <div className="role-text">
                <div className="role-name">{r.label}</div>
                <div className="role-desc">{r.desc}</div>
              </div>
              <i className={'ti ' + (role === r.key ? 'ti-circle-check-filled' : 'ti-circle')} />
            </button>
          ))}
        </div>

        <button className="login-btn" disabled={!role} onClick={() => login(role, name)}>
          Entrer <i className="ti ti-arrow-right" />
        </button>
        <p className="login-note">
          Vous n'aurez accès qu'aux menus correspondant à votre profil.
        </p>
      </div>
    </div>
  );
}
