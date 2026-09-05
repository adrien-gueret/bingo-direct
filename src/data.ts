import type { BingoCell, BingoData, Locale } from "./types";

export const CELL_COUNT = 25;

const suggestionTexts: Record<Locale, string[]> = {
  fr: [
    "Un nouveau Mario",
    "Un remake Zelda",
    "Metroid se montre",
    "Du nouveau pour Splatoon",
    "Retour d’Animal Crossing",
    "Un nouveau Fire Emblem",
    "Une surprise rétro",
    "Annonce inattendue",
    "Une démo disponible maintenant",
    "Encore un farming game",
    "Un JRPG très ambitieux",
    "Un indie coup de cœur",
    "Crossover improbable",
    "Une compilation surprise",
    "Un nouveau jeu de course",
    "Un jeu de rythme",
    "Un classique rejoint le catalogue",
    "Une licence oubliée revient",
    "Un puzzle game adorable",
    "Un nouveau personnage jouable",
    "Un monde ouvert coloré",
    "Quelque chose de très étrange",
    "Une date de sortie proche",
    "Contenu gratuit annoncé",
    "Un portage que personne n’attendait",
    "One more thing…",
    "Donkey Kong revient",
    "Un nouveau Kid Icarus",
    "Une nouvelle licence",
    "Un RPG tactique",
  ],
  en: [
    "A brand-new Mario game",
    "A Zelda remake",
    "Metroid shows up",
    "Something new for Splatoon",
    "Animal Crossing returns",
    "A new Fire Emblem",
    "A retro surprise",
    "An unexpected reveal",
    "Demo available now",
    "Yet another farming game",
    "A very ambitious JRPG",
    "An indie hidden gem",
    "An unlikely crossover",
    "A surprise collection",
    "A new racing game",
    "A rhythm game",
    "A classic joins the catalog",
    "A forgotten series returns",
    "An adorable puzzle game",
    "A new playable character",
    "A colorful open world",
    "Something very strange",
    "A very close release date",
    "Free content announced",
    "A port nobody expected",
    "One more thing…",
    "Donkey Kong returns",
    "A new Kid Icarus",
    "A brand-new IP",
    "A tactical RPG",
  ],
};

export const getSuggestions = (locale: Locale): BingoCell[] =>
  suggestionTexts[locale].map((text) => ({ text, image: "" }));

export const createStarterBingo = (locale: Locale): BingoData => {
  const cells = Array.from({ length: CELL_COUNT }, () => ({
    text: "",
    image: "",
  }));

  return {
    version: 1,
    title: "Bingo Direct",
    subtitle:
      locale === "fr"
        ? "Mes prédictions pour le prochain Direct"
        : "My predictions for the next Direct",
    author: "",
    theme: "red",
    cells,
  };
};

export const emptyBingo = (locale: Locale): BingoData => ({
  ...createStarterBingo(locale),
  title: locale === "fr" ? "Mon Bingo Direct" : "My Bingo Direct",
  subtitle:
    locale === "fr"
      ? "25 prédictions. Combien seront vraies ?"
      : "25 predictions. How many will come true?",
  cells: Array.from({ length: CELL_COUNT }, () => ({ text: "", image: "" })),
});
