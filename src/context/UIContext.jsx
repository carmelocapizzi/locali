// ─── État UI partagé : modale boutique + toast ──────────
import { createContext, useContext, useRef, useState, useCallback } from 'react';

const Ctx = createContext(null);

export function UIProvider({ children }) {
  const [selectedShop, setSelectedShop] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [screen, setScreen] = useState(null); // onglet actif (géré par Shell)
  const timer = useRef(null);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(''), 2800);
  }, []);

  const openShop = useCallback((s) => setSelectedShop(s), []);
  const closeShop = useCallback(() => setSelectedShop(null), []);

  return (
    <Ctx.Provider value={{ selectedShop, openShop, closeShop, toast, toastMsg, screen, setScreen }}>
      {children}
    </Ctx.Provider>
  );
}

export const useUI = () => useContext(Ctx);
