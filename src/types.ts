import type { ThemeName } from "./themes";

export type { ThemeName } from "./themes";
export type Locale = 'fr' | 'en'
export type ImagePosition = { x: number; y: number }

export type BingoCell = {
  text: string
  image: string
  imageLayout?: 'background' | 'above'
  imageFit?: 'cover' | 'contain'
  imagePosition?: ImagePosition
}

export type BingoData = {
  version: 1
  title: string
  subtitle: string
  author: string
  theme: ThemeName
  rows?: number
  columns?: number
  cells: BingoCell[]
}
