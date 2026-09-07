# Bingo Direct

Créez, jouez et partagez une grille de prédictions pour le prochain Nintendo Direct. Le projet est une application entièrement statique construite avec React, TypeScript et Vite.

## Fonctionnalités

- éditeur de grille de 2 à 5 lignes et colonnes avec texte, image, ou les deux ;
- huit thèmes visuels ;
- suggestions aléatoires ;
- mode jeu avec progression sauvegardée par grille ;
- mode Direct plein écran activé par « Cocher », avec progression, partage et export PNG ;
- bibliothèque de grilles enregistrée automatiquement dans le navigateur ;
- création, ouverture, modification, duplication et suppression des grilles ;
- annuler/rétablir les modifications de chaque grille pendant la session ;
- export/import de grilles modifiables et sauvegarde de la bibliothèque en JSON ;
- partage natif de l’image PNG sur les appareils compatibles ;
- téléchargement PNG automatique lorsque le partage de fichiers n’est pas disponible ;
- mise en page responsive ;
- interface bilingue français/anglais, choisie automatiquement selon la langue du navigateur.

Les grilles ne quittent jamais automatiquement le navigateur. Seule l’image est transmise lorsque l’utilisateur choisit explicitement une application dans le menu de partage. Aucun compte, serveur applicatif ou base de données n’est nécessaire.

## Stockage local

La bibliothèque, la grille active, les images et les cases cochées sont conservées dans IndexedDB. Les anciennes grilles restent compatibles et démarrent sans cases cochées. Dupliquer une grille crée une nouvelle partie sans coches. Les images importées sont redimensionnées, converties dans un format web adapté et compressées dans le navigateur avant d’être enregistrées. Ces données restent liées au navigateur et à l’appareil utilisés : vider les données du site les supprime.

Seule la préférence de langue, qui ne représente que quelques caractères, reste dans `localStorage`. Si IndexedDB est indisponible ou si son quota est atteint, l’application le signale au lieu de prétendre que la sauvegarde a réussi.

## Développement local

Prérequis : Node.js 22 et Yarn 1.

```bash
yarn install
yarn dev
```

Vérifier puis construire la version de production :

```bash
yarn lint
yarn test
yarn build
```

Le résultat est généré dans `dist/`.

## Partage d’image

Le bouton **Partager l’image** génère le même PNG que le bouton de téléchargement, y compris le thème, les motifs de fond, les prédictions et les cases déjà cochées.

Lorsque le navigateur prend en charge le partage de fichiers avec `navigator.share()` et `navigator.canShare()`, l’image est transmise au menu de partage natif. Sinon, elle est téléchargée automatiquement afin de pouvoir être envoyée manuellement.

## Déploiement GitHub Actions + FTP

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) construit et déploie automatiquement le projet à chaque push sur `main`.

Dans le dépôt GitHub, ouvrir **Settings → Secrets and variables → Actions**, puis créer ces secrets :

- `FTP_SERVER` : nom d’hôte du serveur FTP ;
- `FTP_USERNAME` : identifiant FTP ;
- `FTP_PASSWORD` : mot de passe FTP.

Créer aussi la variable facultative `FTP_SERVER_DIR` avec le dossier distant, par exemple `/www/` ou `/public_html/bingo/`. Sans cette variable, le déploiement utilise `/`.

Le build conserve `base: './'`, il peut donc être publié à la racine ou dans un sous-dossier.

## Grilles modifiables et sauvegardes

Dans **Mes grilles**, **Exporter mes grilles** exporte toute la bibliothèque dans un fichier `.json` et **Importer des grilles** ouvre une sauvegarde. Les textes, images, dimensions, thèmes et coches sont inclus.

L’import valide entièrement le fichier puis ajoute de nouvelles copies avec des identifiants distincts, sans remplacer les grilles existantes. Les fichiers sont limités à 50 Mo et 200 grilles ; au-delà, exporter les grilles individuellement. Le format porte un identifiant `bingo-direct` et une version `1`. La bibliothèque ne se synchronise pas automatiquement entre appareils ; transférer le fichier suffit pour la retrouver ailleurs. Une image PNG reste un partage visuel, sans données de grille modifiable.

## Annuler et rétablir

Les boutons **Annuler** et **Rétablir** couvrent les textes, images, thèmes, déplacements et dimensions. Les coches appartiennent à la progression de jeu : elles ne créent pas d’étape d’historique et ne sont pas modifiées par ces boutons. L’historique conserve jusqu’à 50 étapes par grille en mémoire, avec regroupement de la saisie rapprochée. Il reste disponible quand on change de grille, et disparaît au rechargement. Une nouvelle modification de la grille efface les étapes à rétablir. La création, la suppression et l’import de grilles ne font pas partie de cet historique.

Raccourcis : `Ctrl/Cmd + Z` pour annuler, `Ctrl/Cmd + Maj + Z` ou `Ctrl + Y` pour rétablir. Dans un champ de texte, les raccourcis natifs du navigateur sont conservés ; les boutons agissent sur l’historique de la grille.

Ce projet de fans n’est pas affilié à Nintendo.

## Rendu et export PNG

`BingoPoster` est commun ? la grille interactive et ? l?export. Sa mise en page
est fix?e ? 800 ? 926 unit?s CSS ; `ScaledPoster` adapte uniquement son ?chelle
? la largeur disponible. Les r?gles `.canonical-poster` ne doivent pas d?pendre
du viewport. `fitPosterText` ajuste les textes longs apr?s chargement des polices.

Les polices sont incluses dans le build. `html-to-image` capture une instance
hors ?cran du m?me composant, avec les cases coch?es et sans les contr?les
d??dition. Les images et polices sont charg?es avant la capture. Le PNG reste
limit? ? 1400 ? 1620 pixels ind?pendamment du pixel ratio du t?l?phone.
Le partage natif conserve le t?l?chargement comme solution de secours.

Tests de régression : `npm test` (grilles, rendu du poster, progression, sauvegardes ordonnées, import/export et historique).
Ils v?rifient les donn?es et le contenu rendu, pas la rasterisation navigateur.
Avant mise en production, comparer l?aper?u et le PNG sur desktop et mobile
(Chrome/Android et Safari/iOS), notamment les l?gendes longues avec image,
les grilles 2 ? 5 et 5 ? 2, les polices, le partage et le t?l?chargement.
