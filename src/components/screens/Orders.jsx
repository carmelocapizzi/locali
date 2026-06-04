import { useState } from 'react';
import { useUI } from '../../context/UIContext';

export default function Orders() {
  const { toast } = useUI();
  const [tab, setTab] = useState('active');

  return (
    <div className="sc-orders">
      <div className="ordhead"><h2>Mes commandes</h2><p>3 commandes en cours</p></div>
      <div className="tabs">
        <div className={'tab' + (tab === 'active' ? ' active' : '')} onClick={() => setTab('active')}>En cours</div>
        <div className={'tab' + (tab === 'history' ? ' active' : '')} onClick={() => setTab('history')}>Historique</div>
      </div>

      {tab === 'active' && (
        <div>
          <div className="ordcard">
            <div className="ordtop">
              <div><div className="ordshop">🥖 Commande locale</div><div className="ordnum">#LCL-2847 · 10h15</div></div>
              <span className="spill s-way">En livraison</span>
            </div>
            <Tracker step={2} />
            <div className="orditems">2× Pain de campagne · 1× Croissant<br />→ Livraison gratuite Locali · ETA : 12 min</div>
            <div className="ordfooter"><span className="ordtotal">5,90 €</span><button className="ordbtn" onClick={() => toast('Suivi GPS activé 🚴')}>Suivre</button></div>
          </div>
          <div className="ordcard" style={{ marginBottom: 20 }}>
            <div className="ordtop">
              <div><div className="ordshop">🌿 Commande ferme locale</div><div className="ordnum">#LCL-2851 · 10h30</div></div>
              <span className="spill s-prep">En préparation</span>
            </div>
            <Tracker step={1} />
            <div className="orditems">1× Panier légumes (5kg) · 2× Œufs (x6)<br />→ Livraison gratuite Locali</div>
            <div className="ordfooter"><span className="ordtotal">20,60 €</span><button className="ordbtn" onClick={() => toast('Détails de la commande')}>Détails</button></div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ paddingBottom: 20 }}>
          <div className="ordcard">
            <div className="ordtop">
              <div><div className="ordshop">🥩 Commerce local</div><div className="ordnum">#LCL-2801 · 28 mai</div></div>
              <span className="spill s-done">Livrée ✓</span>
            </div>
            <div className="orditems">Commande livrée gratuitement · Locali</div>
            <div className="ordfooter"><span className="ordtotal">22,00 €</span><button className="ordbtn" onClick={() => toast('Repassez votre commande !')}>Recommander</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tracker({ step }) {
  const steps = ['Reçue', 'Préparée', 'Livraison', 'Livrée'];
  return (
    <div className="tracker">
      {steps.map((lbl, i) => (
        <div className="tstep" key={i}>
          <div className={'tdot' + (i < step ? ' done' : i === step ? ' cur' : '')}>
            {i < step ? <i className="ti ti-check" style={{ fontSize: 9 }} /> : i === step && i === 2 ? <i className="ti ti-bike" style={{ fontSize: 9, color: 'var(--g4)' }} /> : null}
          </div>
          <div className="tlbl">{lbl}</div>
        </div>
      ))}
    </div>
  );
}
