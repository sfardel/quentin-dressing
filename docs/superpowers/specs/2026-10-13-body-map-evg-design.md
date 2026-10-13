# Body map EVG — « Déguisons Quentin ! » — Design

Date : 2026-10-13

## Objectif

Une petite app web envoyée par lien à un groupe d'amis. Chacun choisit son prénom, clique sur une partie du corps d'une silhouette et indique l'habit ou l'accessoire qu'il ramène pour déguiser Quentin à son EVG. Tout le monde voit en direct ce que les autres ont prévu, pour éviter les doublons.

### Critères de succès

- Un ami ouvre le lien sur son téléphone, sans compte ni installation, et ajoute son accessoire en moins de 30 secondes.
- Les ajouts des autres apparaissent sans recharger la page.
- On voit d'un coup d'œil quelles zones sont déjà couvertes et qui ramène quoi.

### Hors périmètre (YAGNI)

- Authentification réelle (mot de passe, comptes), modération.
- Vue de dos, distinction gauche/droite.
- Modification d'une entrée (on supprime puis on rajoute).
- Liste d'accessoires prédéfinie.

## Amis

Liste fixe de 15 prénoms, affichée par ordre alphabétique :
Adrien, Antoine, Cletch, Constantin, Eli, Fel, Gui, Henri, Jo, Nico, Pierre, Simon, Sofiane, Thieum, Val.

La liste est définie dans `config.js` (`FRIENDS`) et recopiée dans `firestore.rules`. Toute modification doit être faite aux deux endroits.

## Expérience utilisateur

- Écran unique, mobile-first. Titre : « Déguisons Quentin ! 🎉 ».
- **Choix du prénom :** à l'arrivée, si aucun prénom n'est mémorisé, une fenêtre plein écran « Qui es-tu ? » affiche les 15 prénoms sous forme de boutons. Elle ne peut pas être fermée sans choisir. Le choix est mémorisé dans le navigateur. Sous le titre, « Salut Simon · ce n'est pas moi » permet de rouvrir la fenêtre pour changer de prénom ; elle peut alors être fermée sans changer.
- Silhouette SVG de face, 10 zones cliquables : `tete`, `visage`, `cou`, `torse`, `bras`, `mains`, `taille`, `jambes`, `pieds`, `autre` (pancarte, sac…). La zone « Autre » est un bouton/pastille à côté de la silhouette. Les zones sont assez grandes pour un doigt.
- Zone vide : couleur neutre. Zone avec au moins un accessoire : colorée + badge indiquant le nombre.
- Tap sur une zone → panneau en bas de l'écran (bottom sheet) :
  - liste des accessoires déjà prévus pour cette zone (« Henri → perruque fluo ») ;
  - formulaire : « Ce que tu ramènes » + bouton « Ajouter » ;
  - bouton « Supprimer » visible uniquement sur les entrées portant le prénom choisi ;
  - fermeture par bouton, tap sur le fond ou touche Échap.
- Sous la silhouette : récapitulatif de toutes les entrées, groupées par zone.
- Mise à jour en temps réel pour tous les visiteurs.
- Plusieurs accessoires sont autorisés par zone (pas de blocage).

## Architecture

Site statique, sans build : HTML/CSS/JS vanilla en ES modules. SDK Firebase (Firestore) chargé depuis le CDN officiel `https://www.gstatic.com/firebasejs/<version>/…` avec une version figée.

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page, fenêtre de choix du prénom, silhouette SVG inline (chaque zone porte `data-zone`), bottom sheet, récapitulatif. |
| `style.css` | Styles mobile-first, couleurs en variables CSS. |
| `config.js` | `GROOM_NAME = "Quentin"`, `FRIENDS`, liste ordonnée des zones `{ id, label }`, objet `firebaseConfig` à remplir. |
| `store.js` | Accès Firestore uniquement : `subscribe(onChange, onError)`, `addItem({ zone, item, name })`, `deleteItem(id)`. Aucune manipulation du DOM. |
| `app.js` | Prénom courant, rendu (fenêtre de choix, badges, panneau, récapitulatif), gestion des événements. |
| `firestore.rules` | Règles de sécurité à coller dans la console Firebase. |
| `README.md` | Mise en place Firebase + publication GitHub Pages. |

### Données

Collection unique `items`. Document :

```
{ zone: string, item: string, name: string, createdAt: serverTimestamp }
```

- `name` : un prénom de `FRIENDS`. C'est aussi ce qui détermine qui peut supprimer une entrée dans l'interface, ce qui fonctionne sur tous les appareils d'un même ami.
- Le prénom choisi est stocké dans `localStorage`. Tout accès à `localStorage` est protégé par try/catch ; s'il est indisponible, la fenêtre de choix réapparaît à chaque visite, et le reste fonctionne. Un prénom mémorisé qui ne figure plus dans `FRIENDS` est ignoré, et la fenêtre de choix s'affiche.

### Flux de données

- Un seul `onSnapshot` sur `items`, trié par `createdAt`. À chaque changement, `app.js` regroupe les entrées par zone et redessine les badges, le panneau ouvert et le récapitulatif.
- L'ajout et la suppression passent par `store.js`. L'interface se met à jour via le snapshot, sans mise à jour optimiste séparée.

### Règles Firestore

- `read` : autorisé pour tous.
- `create` : autorisé si le document contient exactement les clés `zone`, `item`, `name`, `createdAt`, si `zone` appartient à la liste des 10 zones, si `name` appartient à la liste des 15 prénoms, si `item` est une chaîne de 1 à 60 caractères et si `createdAt == request.time`.
- `update` : refusé.
- `delete` : autorisé pour tous. Sans authentification, le serveur ne peut pas vérifier l'auteur (n'importe qui peut choisir n'importe quel prénom) ; la restriction est appliquée uniquement dans l'interface. C'est un compromis accepté pour un usage entre amis.

## Gestion des erreurs

- `firebaseConfig` non rempli → bandeau explicite (« Config Firebase manquante, voir README ») ; la silhouette reste affichée.
- Échec de lecture (snapshot) ou d'écriture → message court non bloquant (toast).
- Accessoire obligatoire, espaces retirés en début et fin, limité à 60 caractères côté client (en plus des règles). Prénom obligatoire et présent dans `FRIENDS`.
- Tout texte venant de la base est inséré via `textContent`, jamais via `innerHTML`.
- Bouton « Ajouter » désactivé pendant l'envoi pour éviter les doublons.

## Tests

Vérification manuelle dans Chrome (DevTools MCP), en vue mobile (390 px) et desktop :

1. Sans config Firebase : le bandeau s'affiche et la page ne plante pas.
2. Première visite : la fenêtre « Qui es-tu ? » s'affiche ; après un choix et un rechargement, elle ne réapparaît pas.
3. Ajout d'un accessoire → badge + panneau + récapitulatif mis à jour.
4. Deux onglets ouverts : un ajout dans l'un apparaît dans l'autre.
5. Le bouton « Supprimer » n'apparaît que sur les entrées du prénom choisi, et la suppression se propage.
6. Saisie de HTML (`<b>x</b>`) → affiché comme texte.
7. Accessoire vide ou trop long → refusé.
