import type { ThemeName } from "./themes";

export type { ThemeName } from "./themes";
export type Locale = 'fr' | 'en'

export type BingoCell = {
  text: string
  image: string
}

export type BingoData = {
  version: 1
  title: string
  subtitle: string
  author: string
  theme: ThemeName
  cells: BingoCell[]
}
