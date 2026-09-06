# Bingo Direct

Créez, jouez et partagez en image une grille de 25 prédictions pour le prochain Nintendo Direct. Le projet est une application entièrement statique construite avec React, TypeScript et Vite.

## Fonctionnalités

- éditeur de grille 5×5 avec texte, image, ou les deux ;
- quatre thèmes visuels ;
- suggestions et remplissage aléatoire ;
- mode jeu avec détection des lignes de bingo ;
- bibliothèque de grilles enregistrée automatiquement dans le navigateur ;
- création, ouverture, modification, duplication et suppression des grilles ;
- partage natif de l’image PNG sur les appareils compatibles ;
- téléchargement PNG automatique lorsque le partage de fichiers n’est pas disponible ;
- mise en page responsive ;
- interface bilingue français/anglais, choisie automatiquement selon la langue du navigateur.

Les grilles ne quittent jamais automatiquement le navigateur. Seule l’image est transmise lorsque l’utilisateur choisit explicitement une application dans le menu de partage. Aucun compte, serveur applicatif ou base de données n’est nécessaire.

## Stockage local

La bibliothèque, la grille active, les images et toutes les modifications sont conservées dans IndexedDB. Les images importées sont redimensionnées, converties dans un format web adapté et compressées dans le navigateur avant d’être enregistrées. Ces données restent liées au navigateur et à l’appareil utilisés : vider les données du site les supprime.

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

## Limite volontaire du MVP

Une image partagée ne peut pas être rouverte comme grille interactive sur un autre appareil et la bibliothèque n’est pas synchronisée entre appareils. Un export/import JSON pourra être ajouté ultérieurement si ce besoin apparaît, sans nécessiter de backend.

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

Tests de r?gression : `node tests/grid.test.mjs` et `node tests/poster.test.mjs`.
Ils v?rifient les donn?es et le contenu rendu, pas la rasterisation navigateur.
Avant mise en production, comparer l?aper?u et le PNG sur desktop et mobile
(Chrome/Android et Safari/iOS), notamment les l?gendes longues avec image,
les grilles 2 ? 5 et 5 ? 2, les polices, le partage et le t?l?chargement.
