// Coquille de l'app connectée : status bar + écran actif + nav filtrée par rôle.
import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import StatusBar from './StatusBar';
import BottomNav from './BottomNav';
import ShopModal from './ShopModal';
import Toast from './Toast';
import Home from './screens/Home';
import MapScreen from './screens/MapScreen';
import Markets from './screens/Markets';
import Orders from './screens/Orders';
import Merchant from './screens/Merchant';
import Delivery from './screens/Delivery';

const SCREEN_META = {
  home:     { label: 'Accueil',   icon: 'ti-home',           Comp: Home },
  map:      { label: 'Carte',     icon: 'ti-map',            Comp: MapScreen },
  markets:  { label: 'Agenda',    icon: 'ti-calendar-event', Comp: Markets },
  orders:   { label: 'Commandes', icon: 'ti-shopping-bag',   Comp: Orders, badge: 3 },
  merchant: { label: 'Commerce',  icon: 'ti-building-store', Comp: Merchant },
  delivery: { label: 'Livreur',   icon: 'ti-bike',           Comp: Delivery },
};

// Accès aux menus selon le rôle connecté
const ROLE_NAV = {
  client:     ['home', 'map', 'markets', 'orders'],
  commercant: ['merchant', 'map', 'markets'],
  livreur:    ['delivery', 'map'],
};

export default function Shell() {
  const { user } = useAuth();
  const { screen, setScreen } = useUI();
  const tabs = ROLE_NAV[user.role] || ['home'];
  const active = tabs.includes(screen) ? screen : tabs[0];
  const contentRef = useRef(null);

  // Si le rôle change (ou au démarrage), on cale sur un onglet autorisé
  useEffect(() => {
    if (!tabs.includes(screen)) setScreen(tabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);

  // Reset du scroll à chaque changement d'écran
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [active]);

  const Comp = SCREEN_META[active].Comp;
  const items = tabs.map((k) => ({ key: k, ...SCREEN_META[k] }));

  return (
    <div className="frame">
      <StatusBar />
      <div className="content" ref={contentRef}>
        <div className="screen active" key={active}>
          <Comp />
        </div>
      </div>
      <BottomNav items={items} active={active} onChange={setScreen} />
      <ShopModal />
      <Toast />
    </div>
  );
}
