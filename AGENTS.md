# Bingo Direct

Application React + TypeScript + Vite entièrement statique. Les grilles et leurs images sont conservées dans IndexedDB ; seule la préférence de langue utilise `localStorage`. Le partage produit une image PNG ; ne pas introduire de backend sans demande explicite.

## Commandes

- `npm run dev` : serveur de développement
- `npm run lint` : validation TypeScript
- `npm run build` : build de production dans `dist/`
- `npm run preview` : aperçu du build

## Conventions

- Interface et textes utilisateur en français et en anglais. Centraliser les traductions dans `src/i18n.ts`.
- Préserver l’accessibilité clavier et les libellés ARIA.
- Tester le rendu desktop et mobile après toute modification visuelle.
- Garder `base: './'` dans Vite afin que le build fonctionne dans un sous-dossier FTP.
- Ne jamais stocker d’identifiants FTP dans le dépôt ; utiliser les secrets GitHub Actions.
- Préserver le partage natif du PNG avec téléchargement en solution de secours.

## Validation attendue

Avant de terminer une modification, exécuter `npm run lint` et `npm run build`.
