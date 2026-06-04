// ─── État UI : navigation (historique robuste), modale, toast ─
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const Ctx = createContext(null);

export function UIProvider({ children }) {
  const [selectedShop, setSelectedShop] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [screen, setScreenState] = useState(null);
  const [stack, setStack] = useState([]); // écrans précédents
  const timer = useRef(null);
  const stackRef = useRef([]);
  const shopRef = useRef(null);
  stackRef.current = stack;
  shopRef.current = selectedShop;

  const arm = () => { try { window.history.pushState({ locali: 1 }, ''); } catch (e) {} };

  // Sentinelle d'historique au montage → le bouton retour matériel ne quitte jamais l'app
  useEffect(() => { arm(); }, []);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(''), 2800);
  }, []);

  // Navigation "avant" : empile l'écran courant + une entrée d'historique
  const setScreen = useCallback((next) => {
    setScreenState((cur) => {
      if (next !== cur) { if (cur != null) setStack((st) => [...st, cur]); arm(); }
      return next;
    });
  }, []);

  // Reset (changement de rôle) : nouvel écran racine, pile vidée
  const resetTo = useCallback((next) => { setScreenState(next); setStack([]); }, []);

  const openShop = useCallback((s) => setSelectedShop(s), []);
  const closeShop = useCallback(() => setSelectedShop(null), []);

  // Bouton Retour : ferme la modale d'abord, sinon recule via l'historique navigateur
  const back = useCallback(() => {
    if (shopRef.current) { setSelectedShop(null); return; }
    try { window.history.back(); } catch (e) {
      if (stackRef.current.length) {
        const prev = stackRef.current[stackRef.current.length - 1];
        setScreenState(prev);
        setStack((st) => st.slice(0, -1));
      }
    }
  }, []);

  // Retour matériel / navigateur (popstate) : même logique, et on RE-ARME si rien à dépiler
  useEffect(() => {
    const onPop = () => {
      if (shopRef.current) { setSelectedShop(null); arm(); return; }
      if (stackRef.current.length) {
        const prev = stackRef.current[stackRef.current.length - 1];
        setScreenState(prev);
        setStack((st) => st.slice(0, -1));
      } else {
        arm(); // on est à l'accueil → on reste dans l'app
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
