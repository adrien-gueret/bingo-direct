import type { CSSProperties } from "react";

export const themeDefinitions = {
  red: { primary: "#e60012", dark: "#8d000b", soft: "#fff0ed", accent: "#ffd23f", ink: "#251c1d", gridInk: "#72000a" },
  violet: { primary: "#6c3cff", dark: "#2d126b", soft: "#f0ebff", accent: "#ffcc4d", ink: "#201733", gridInk: "#35167c" },
  ocean: { primary: "#007aa8", dark: "#003b55", soft: "#e8f8fd", accent: "#6be8ff", ink: "#142931", gridInk: "#004964" },
  lime: { primary: "#247845", dark: "#103b23", soft: "#f2fadf", accent: "#cfff47", ink: "#1c291e", gridInk: "#173e24" },
  yellow: { primary: "#e2b900", dark: "#765800", soft: "#fff8cc", accent: "#e60012", ink: "#302600", gridInk: "#594300" },
  orange: { primary: "#ed6a12", dark: "#853000", soft: "#fff0e5", accent: "#ffe066", ink: "#331b0d", gridInk: "#6b2600" },
  pink: { primary: "#df3f86", dark: "#7a1746", soft: "#ffeaf3", accent: "#74efff", ink: "#341624", gridInk: "#701d43" },
  midnight: { primary: "#202229", dark: "#050608", soft: "#eceef2", accent: "#ffd23f", ink: "#17191e", gridInk: "#111318" },
} as const;

export type ThemeName = keyof typeof themeDefinitions;
export type ThemeDefinition = (typeof themeDefinitions)[ThemeName];

export const themeNames = Object.keys(themeDefinitions) as ThemeName[];

export const isThemeName = (value: unknown): value is ThemeName =>
  typeof value === "string" && value in themeDefinitions;

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

export const getThemeStyle = (theme: ThemeName): ThemeStyle => {
  const colors = themeDefinitions[theme];
  return {
    "--primary": colors.primary,
    "--primary-dark": colors.dark,
    "--primary-soft": colors.soft,
    "--accent": colors.accent,
    "--ink": colors.ink,
    "--grid-ink": colors.gridInk,
  };
};
