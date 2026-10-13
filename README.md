# Déguisons Quentin ! 🎉

Petite page pour que chaque ami choisisse son prénom et indique, sur une silhouette, l'habit ou l'accessoire qu'il ramène pour déguiser Quentin à son EVG. La liste est partagée en temps réel.

## Essayer sans Firebase

```bash
npx --yes http-server@14.1.1 -p 5173 -c-1 .
```

Puis ouvrir http://localhost:5173/?demo (les données restent dans ce navigateur).

## Mise en place Firebase (5 min, gratuit)

1. Aller sur https://console.firebase.google.com, puis « Ajouter un projet » (Google Analytics n'est pas nécessaire).
2. Menu « Build › Firestore Database », puis « Créer une base de données ». Choisir une région en Europe (ex. `eur3`) et le mode production.
3. Onglet « Règles » : remplacer le contenu par celui de `firestore.rules`, puis « Publier ».
4. Engrenage « Paramètres du projet », section « Vos applications », puis l'icône `</>` (Web). Donner un nom, sans Hosting.
5. Copier l'objet `firebaseConfig` affiché dans `config.js`, à la place de l'objet vide.

Les clés de `firebaseConfig` ne sont pas des secrets : la sécurité repose sur `firestore.rules`.

## Publier sur GitHub Pages

1. Créer un dépôt GitHub et y pousser ce dossier.
2. « Settings › Pages », source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Envoyer au groupe l'URL affichée (`https://<compte>.github.io/<dépôt>/`).

## Personnaliser

Le prénom du marié, la liste des amis, les zones et la limite de caractères sont dans `config.js`.

⚠️ Si tu modifies la liste des amis (`FRIENDS`), recopie-la aussi dans `firestore.rules`, puis republie les règles dans la console Firebase. Sinon, les nouveaux prénoms ne pourront rien ajouter.

## Tests

```bash
npm test
```

## Limites connues

Il n'y a pas de mot de passe : n'importe qui ayant le lien peut choisir n'importe quel prénom, et techniquement supprimer une entrée. Le bouton « Supprimer » n'est affiché que sur les entrées du prénom choisi, mais le serveur ne le vérifie pas. C'est suffisant entre amis.
