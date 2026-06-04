# Locali — React + Vite

Commerces locaux réels près de chez vous (données OpenStreetMap / Overpass + carte Leaflet).

## Démarrer

```bash
npm install      # installe les dépendances
npm run dev      # lance le serveur de dev (http://localhost:5173)
npm run build    # build de production dans dist/
npm run preview  # prévisualise le build
npm run hello    # affiche "Locali fonctionne !"
```

> La géolocalisation et les appels Overpass/Nominatim nécessitent `http(s)://`
> (donc `npm run dev`, pas l'ouverture directe d'un fichier). Si la position est
> refusée, l'app bascule sur **Bassilly (Silly, Belgique)** par défaut.

### Tester soi-même
1. `npm install` (une seule fois), puis `npm run dev`.
2. Ouvrir l'URL affichée (http://localhost:5173) et **autoriser la géolocalisation**.
3. Forcer un lieu de test sans GPS :
   - `http://localhost:5173/?place=Bassilly`
   - `http://localhost:5173/?lat=50.645&lon=3.91`
4. Tester sur téléphone (même réseau Wi-Fi) : `npm run dev -- --host`, puis ouvrir
   `http://<IP-de-votre-PC>:5173` sur le mobile.

### Envoyer à quelqu'un
**Option A — envoyer le code** (le destinataire a Node) : zippez le dossier *sans*
`node_modules`, il fait `npm install` puis `npm run dev`.
```powershell
Compress-Archive -Path (Get-ChildItem . -Exclude 'node_modules','dist') -DestinationPath ..\locali-react.zip -Force
```

**Option B — envoyer un lien (le plus simple, aucun logiciel requis côté destinataire)** :
```bash
npm run build         # génère le dossier dist/
```
puis déposez le dossier `dist/` sur un hébergeur statique gratuit :
- **Netlify Drop** : https://app.netlify.com/drop — glissez-déposez `dist/`, vous obtenez une URL publique en quelques secondes.
- ou **Vercel**, **Cloudflare Pages**, **GitHub Pages** (tous gratuits pour un site statique).

## Connexion par rôle

Au lancement, on choisit un profil — **chaque rôle n'a accès qu'à ses menus** :

| Rôle | Menus accessibles |
|------|-------------------|
| 🛒 Client | Accueil · Carte · Commandes |
| 🏪 Commerçant | Commerce · Carte |
| 🚴 Livreur | Livreur · Carte |

Le rôle est mémorisé (localStorage). Bouton de déconnexion en haut à droite.

### Agenda (marchés & événements)
- **Marchés** : liste curée vérifiée (sites communaux + marches-de-belgique.be) fusionnée avec les `amenity=marketplace` d'OpenStreetMap, filtrée par distance → fonctionne partout, enrichie là où la liste curée existe.
- **Événements** : publiés par les **commerçants** (brocante, fête, promo…) + source ouverte **OpenAgenda** (optionnelle).
- **Alertes** 🔔 par marché/événement (rappel local quand c'est aujourd'hui).

#### Activer OpenAgenda (événements communaux automatiques)
1. Créez une clé publique gratuite sur https://developers.openagenda.com et repérez l'UID d'un agenda.
2. Copiez `.env.example` en `.env` et renseignez `VITE_OPENAGENDA_KEY` et `VITE_OPENAGENDA_AGENDA`.
3. Relancez `npm run dev`. Sans clé, l'app fonctionne normalement (les événements viennent alors uniquement des commerçants).

### Côté commerçant
- **Sans abonnement / essai** : seules les *livraisons déjà effectuées par d'autres
  dans le rayon d'action* sont visibles (carte + activité + stats). Le reste est verrouillé.
- **Avec abonnement OU essai gratuit 7 jours** : gestion libre des produits à la
  commande (ajout / activation / suppression), aperçu client, stats, publication.

## Structure

```
src/
├── main.jsx                  # point d'entrée + providers
├── App.jsx                   # Login si non connecté, sinon Shell
├── index.css                 # styles
├── data/constants.js         # types, catégories, produits, rôles…
├── utils/                    # geo, overpass, hours, deliveries
├── context/                  # AuthContext, LocaliContext, UIContext
└── components/
    ├── StatusBar / BottomNav / Toast / Login / Shell
    ├── ShopCard / ShopModal
    └── screens/  Home · MapScreen · Orders · Merchant · Delivery
```

## hello.js

Petit script Node de vérification :

```bash
node hello.js   # -> Locali fonctionne !
```
