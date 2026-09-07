import type { BingoCell, BingoData, Locale } from "./types";

export const CELL_COUNT = 25;

const suggestionTexts: Record<Locale, string[]> = {
  fr: [
    "Un nouveau Mario",
    "Un remake Zelda",
    "Metroid se montre",
    "Du nouveau pour Splatoon",
    "Retour d'Animal Crossing",
    "Un nouveau Fire Emblem",
    "Une surprise rétro",
    "Un nouveau jeu Kirby",
    "Une démo disponible maintenant",
    '"Please understand"',
    "Un autre JRPG",
    "Un indie coup de cœur",
    "Crossover improbable",
    "Une compilation surprise",
    "Un jeu de rythme",
    "Un classique rejoint le catalogue",
    "Une licence oubliée revient",
    "Un puzzle game adorable",
    "Un DLC pour un jeu existant",
    "Un monde ouvert coloré",
    "Quelque chose de très étrange",
    "Un dirigeant de Nintendo se met en scène de façon ridicule",
    "Contenu gratuit annoncé",
    "Un portage que personne n'attendait",
    '"One more thing..."',
    "Un jeu-concept avec Donkey Kong",
    "Un jeu Yoshi tout mignon",
    "Une nouvelle licence",
    "Un RPG tactique",
    "WARIO LAND !!!",
  ],
  en: [
    "A brand-new Mario game",
    "A Zelda remake",
    "Metroid makes an appearance",
    "Something new for Splatoon",
    "Animal Crossing returns",
    "A new Fire Emblem game",
    "A retro surprise",
    "A new Kirby game",
    "A demo available right away",
    '"Please understand"',
    "Another JRPG",
    "An indie gem",
    "An unlikely crossover",
    "A surprise compilation",
    "A rhythm game",
    "A classic joins the catalog",
    "A forgotten franchise returns",
    "An adorable puzzle game",
    "DLC for an existing game",
    "A colorful open world",
    "Something very strange",
    "A Nintendo executive makes a fool of themselves",
    "Free content announced",
    "A port nobody expected",
    '"One more thing..."',
    "A Donkey Kong game",
    "A cute Yoshi game",
    "A brand-new IP",
    "A tactical RPG",
    "WARIO LAND !!!",
  ],
};

export const getSuggestions = (locale: Locale): BingoCell[] =>
  suggestionTexts[locale].map((text) => ({ text, image: "" }));

export const getRandomSuggestions = (
  locale: Locale,
  count = 5,
): BingoCell[] => {
  const suggestions = getSuggestions(locale);
  for (let index = suggestions.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [suggestions[index], suggestions[randomIndex]] = [
      suggestions[randomIndex],
      suggestions[index],
    ];
  }
  return suggestions.slice(0, count);
};

export const createStarterBingo = (locale: Locale): BingoData => {
  const cells = Array.from({ length: CELL_COUNT }, () => ({
    text: "",
    image: "",
  }));

  return {
    version: 1,
    rows: 5,
    columns: 5,
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

// Missing dimensions identify grids saved before configurable sizes existed.
export const gridDimensions = (bingo: BingoData) => ({
  rows: bingo.rows ?? 5,
  columns: bingo.columns ?? 5,
});

export const resizeBingo = (
  bingo: BingoData,
  rows: number,
  columns: number,
): BingoData => {
  const previous = gridDimensions(bingo);
  return {
    ...bingo,
    rows,
    columns,
    cells: Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      return row < previous.rows && column < previous.columns
        ? { ...bingo.cells[row * previous.columns + column] }
        : { text: "", image: "" };
    }),
  };
};

export const winningLines = (
  checked: Set<number>,
  rows: number,
  columns: number,
) => {
  const lines: number[][] = [];
  for (let row = 0; row < rows; row += 1)
    lines.push(
      Array.from({ length: columns }, (_, column) => row * columns + column),
    );
  for (let column = 0; column < columns; column += 1)
    lines.push(
      Array.from({ length: rows }, (_, row) => row * columns + column),
    );
  if (rows === columns) {
    lines.push(Array.from({ length: rows }, (_, i) => i * columns + i));
    lines.push(
      Array.from({ length: rows }, (_, i) => i * columns + columns - 1 - i),
    );
  }
  return lines.filter((line) => line.every((index) => checked.has(index)));
};
