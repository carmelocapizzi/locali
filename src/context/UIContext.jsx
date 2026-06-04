// ─── État UI partagé : navigation (historique + retour), modale, toast ─
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const Ctx = createContext(null);

export function UIProvider({ children }) {
  const [selectedShop, setSelectedShop] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [screen, setScreenState] = useState(null);
  const [stack, setStack] = useState([]); // écrans précédents (pour le retour)
  const timer = useRef(null);

  // Réfs pour le gestionnaire popstate (bouton retour matériel / navigateur)
  const shopRef = useRef(null);
  shopRef.current = selectedShop;

  const pushHist = () => { try { window.history.pushState({ locali: 1 }, ''); } catch (e) {} };

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(''), 2800);
  }, []);

  // Navigation "avant" : empile l'écran courant
  const setScreen = useCallback((next) => {
    setScreenState((cur) => {
      if (next !== cur) {
        if (cur != null) setStack((st) => [...st, cur]);
        pushHist();
      }
      return next;
    });
  }, []);

  // Reset (changement de rôle) : nouvel écran racine, historique vidé
  const resetTo = useCallback((next) => {
    setScreenState(next);
    setStack([]);
  }, []);

  // Retour : ferme la modale si ouverte, sinon dépile l'écran précédent
  const back = useCallback(() => {
    if (shopRef.current) { setSelectedShop(null); return; }
    setStack((st) => {
      if (!st.length) return st;
      setScreenState(st[st.length - 1]);
      return st.slice(0, -1);
    });
  }, []);

  const openShop = useCallback((s) => { setSelectedShop(s); pushHist(); }, []);
  const closeShop = useCallback(() => setSelectedShop(null), []);

  // Bouton retour matériel / navigateur → même logique que le bouton Retour
  useEffect(() => {
    const onPop = () => back();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [back]);

  const canGoBack = stack.length > 0 || !!selectedShop;

  return (
    <Ctx.Provider
      value={{ selectedShop, openShop, closeShop, toast, toastMsg, screen, setScreen, resetTo, back, canGoBack }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useUI = () => useContext(Ctx);
