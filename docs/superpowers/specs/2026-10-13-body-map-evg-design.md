# Body map EVG — « Déguisons Quentin ! » — Design

Date : 2026-10-13

## Objectif

Une petite app web envoyée par lien à un groupe d'amis. Chacun clique sur une partie du corps d'une silhouette et indique l'habit ou l'accessoire qu'il ramène pour déguiser Quentin à son EVG. Tout le monde voit en direct ce que les autres ont prévu, pour éviter les doublons.

### Critères de succès

- Un ami ouvre le lien sur son téléphone, sans compte ni installation, et ajoute son accessoire en moins de 30 secondes.
- Les ajouts des autres apparaissent sans recharger la page.
- On voit d'un coup d'œil quelles zones sont déjà couvertes et qui ramène quoi.

### Hors périmètre (YAGNI)

- Authentification, comptes, modération.
- Vue de dos, distinction gauche/droite.
- Modification d'une entrée (on supprime puis on rajoute).
- Liste d'accessoires prédéfinie.

## Expérience utilisateur

- Écran unique, mobile-first. Titre : « Déguisons Quentin ! 🎉 ».
- Silhouette SVG de face, 10 zones cliquables : `tete`, `visage`, `cou`, `torse`, `bras`, `mains`, `taille`, `jambes`, `pieds`, `autre` (pancarte, sac…). La zone « Autre » est un bouton/pastille à côté de la silhouette. Les zones sont assez grandes pour un doigt.
- Zone vide : couleur neutre. Zone avec au moins un accessoire : colorée + badge indiquant le nombre.
- Tap sur une zone → panneau en bas de l'écran (bottom sheet) :
  - liste des accessoires déjà prévus pour cette zone (« Marc → perruque fluo ») ;
  - formulaire : « Ton prénom » (pré-rempli si déjà saisi) + « Ce que tu ramènes » + bouton « Ajouter » ;
  - bouton « Supprimer » visible uniquement sur ses propres entrées ;
  - fermeture par bouton, tap sur le fond ou touche Échap.
- Sous la silhouette : récapitulatif de toutes les entrées, groupées par zone.
- Mise à jour en temps réel pour tous les visiteurs.
- Plusieurs accessoires sont autorisés par zone (pas de blocage).

## Architecture

Site statique, sans build : HTML/CSS/JS vanilla en ES modules. SDK Firebase (Firestore) chargé depuis le CDN officiel `https://www.gstatic.com/firebasejs/<version>/…` avec une version figée.

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page, silhouette SVG inline (chaque zone porte `data-zone`), bottom sheet, récapitulatif. |
| `style.css` | Styles mobile-first, couleurs en variables CSS. |
| `config.js` | `GROOM_NAME = "Quentin"`, liste ordonnée des zones `{ id, label }`, objet `firebaseConfig` à remplir. |
| `store.js` | Accès Firestore uniquement : `subscribe(onChange, onError)`, `addItem({ zone, item, name, ownerId })`, `deleteItem(id)`. Aucune manipulation du DOM. |
| `app.js` | Identité locale (prénom + `ownerId`), rendu (badges, panneau, récapitulatif), gestion des événements. |
| `firestore.rules` | Règles de sécurité à coller dans la console Firebase. |
| `README.md` | Mise en place Firebase + publication GitHub Pages. |

### Données

Collection unique `items`. Document :

```
{ zone: string, item: string, name: string, ownerId: string, createdAt: serverTimestamp }
```

- `ownerId` : UUID aléatoire (`crypto.randomUUID()`) généré une fois puis stocké dans `localStorage`, avec le prénom. Tout accès à `localStorage` est protégé par try/catch ; s'il est indisponible, l'app fonctionne quand même (on ne retrouve simplement pas ses entrées après un rechargement).

### Flux de données

- Un seul `onSnapshot` sur `items`, trié par `createdAt`. À chaque changement, `app.js` regroupe les entrées par zone et redessine les badges, le panneau ouvert et le récapitulatif.
- L'ajout et la suppression passent par `store.js`. L'interface se met à jour via le snapshot, sans mise à jour optimiste séparée.

### Règles Firestore

- `read` : autorisé pour tous.
- `create` : autorisé si le document contient exactement les clés `zone`, `item`, `name`, `ownerId`, `createdAt`, si `zone` appartient à la liste des 10 zones, si `item` et `name` sont des chaînes de 1 à 60 caractères, si `ownerId` est une chaîne de 1 à 64 caractères et si `createdAt == request.time`.
- `update` : refusé.
- `delete` : autorisé pour tous. Sans authentification, le serveur ne peut pas vérifier l'auteur ; la restriction « seulement ses entrées » est appliquée uniquement dans l'interface. C'est un compromis accepté pour un usage entre amis.

## Gestion des erreurs

- `firebaseConfig` non rempli → bandeau explicite (« Config Firebase manquante, voir README ») ; la silhouette reste affichée.
- Échec de lecture (snapshot) ou d'écriture → message court non bloquant (toast).
- Prénom et accessoire obligatoires, espaces retirés en début et fin, limités à 60 caractères côté client (en plus des règles).
- Tout texte venant de la base est inséré via `textContent`, jamais via `innerHTML`.
- Bouton « Ajouter » désactivé pendant l'envoi pour éviter les doublons.

## Tests

Vérification manuelle dans Chrome (DevTools MCP), en vue mobile (390 px) et desktop :

1. Sans config Firebase : le bandeau s'affiche et la page ne plante pas.
2. Avec une config (projet de l'utilisateur ou émulateur Firestore) : ajout d'un accessoire → badge + panneau + récapitulatif mis à jour.
3. Deux onglets ouverts : un ajout dans l'un apparaît dans l'autre.
4. Le bouton « Supprimer » n'apparaît que sur ses propres entrées, et la suppression se propage.
5. Saisie de HTML (`<b>x</b>`) → affiché comme texte.
6. Champs vides ou trop longs → refusés.
