// ─── Authentification par rôle (client / livreur / commerçant) ─
import { createContext, useContext, useState } from 'react';
import { ROLES } from '../data/constants';

const KEY = 'locali.auth';
const AuthCtx = createContext(null);

function defaultName(role) {
  const r = ROLES.find((x) => x.key === role);
  return r ? r.label : 'Utilisateur';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  const login = (role, name) => {
    const u = { role, name: (name && name.trim()) || defaultName(role) };
    try { localStorage.setItem(KEY, JSON.stringify(u)); } catch (e) {}
    setUser(u);
  };

  const logout = () => {
    try { localStorage.removeItem(KEY); } catch (e) {}
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
