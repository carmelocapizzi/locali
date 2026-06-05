// ─── « Comment ça marche » : transparence sur le circuit de l'argent ─
// Affiché à chaque rôle, en clair : d'où vient l'argent qui paie les livraisons,
// pourquoi un seuil, pourquoi commande & collecte en dessous.
import { COMMISSION_RATE, COURIER_FEE, DEFAULT_FREE_THRESHOLD } from '../utils/delivery';

const PCT = Math.round(COMMISSION_RATE * 100);

export default function HowItWorks({ role = 'client', onClose }) {
  return (
    <div className="hiw-overlay" onClick={onClose}>
      <div className="hiw-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="hiw-close" onClick={onClose}><i className="ti ti-x" /></button>
        <div className="hiw-kind">💡 Comment ça marche</div>
        <h3 className="hiw-title">D'où vient l'argent ?</h3>

        <div className="hiw-principle">
          <strong>Le prix dans l'app = le prix en magasin.</strong> On ne prend rien sur votre panier,
          et les commerçants n'augmentent pas leurs prix pour Locali.
        </div>

        {/* Le circuit de l'argent, identique pour tous */}
        <div className="hiw-flow">
          <div className="hiw-step"><span className="hiw-em">🧺</span><div><b>Le client</b> paie le prix magasin (rien de plus).</div></div>
          <div className="hiw-arrow">↓</div>
          <div className="hiw-step"><span className="hiw-em">🏪</span><div><b>Le commerçant</b> reverse une commission de <b>{PCT}%</b> — uniquement sur les ventes que Locali lui apporte.</div></div>
          <div className="hiw-arrow">↓</div>
          <div className="hiw-step"><span className="hiw-em">🤝</span><div><b>Des commerces sponsors</b> du quartier complètent la cagnotte (visibilité en échange).</div></div>
          <div className="hiw-arrow">↓</div>
          <div className="hiw-step"><span className="hiw-em">🚲</span><div><b>Le livreur</b> est payé en vrai ({COURIER_FEE.toFixed(0)} € / livraison) + avantages.</div></div>
          <div className="hiw-arrow">↓</div>
          <div className="hiw-step ok"><span className="hiw-em">🎁</span><div><b>La livraison est offerte</b> au client dès {DEFAULT_FREE_THRESHOLD} € de panier.</div></div>
        </div>

        <div className="hiw-q">
          <div className="hiw-qt">Pourquoi un seuil, et la « commande & collecte » en dessous ?</div>
          <p>Une toute petite commande ne permet pas de rémunérer correctement un livreur. En dessous de {DEFAULT_FREE_THRESHOLD} €,
          vous commandez et passez retirer en magasin — c'est gratuit, ça vous réserve vos produits, et ça reste équitable pour tout le monde.</p>
        </div>

        {role === 'client' && (
          <div className="hiw-role">
            <div className="hiw-rt">🧺 Côté client</div>
            <p>Vous payez le juste prix, vous trouvez les commerces autour de vous en un coup d'œil, et la livraison ne vous coûte rien. Acheter local, simplement.</p>
          </div>
        )}
        {role === 'commercant' && (
          <div className="hiw-role">
            <div className="hiw-rt">🏪 Côté commerçant</div>
            <p>Vous <b>vendez plus sans travailler plus</b> : Locali vous amène des clients, vous ne payez la commission que sur ces ventes-là. Elle finance la rémunération du livreur — pas votre poche, pas celle du client. Vous pouvez aussi offrir des avantages aux livreurs (vos ambassadeurs).</p>
          </div>
        )}
        {role === 'livreur' && (
          <div className="hiw-role">
            <div className="hiw-rt">🚲 Côté livreur</div>
            <p>Vous êtes <b>payé en argent réel</b> ({COURIER_FEE.toFixed(0)} € / livraison), financé par la commission des commerçants et les sponsors. En plus : des avantages chez les commerces, et des <b>tournées groupées</b> qui augmentent vos gains.</p>
          </div>
        )}
        {role === 'sponsor' && (
          <div className="hiw-role">
            <div className="hiw-rt">🤝 Côté sponsor</div>
            <p>Vous financez les livraisons offertes de votre quartier. En échange : votre nom sur « Livraison offerte par vous », un badge <b>Sponsor local</b>, et la reconnaissance d'un commerce qui soutient la proximité.</p>
          </div>
        )}

        <button className="hiw-ok" onClick={onClose}>J'ai compris</button>
      </div>
    </div>
  );
}
