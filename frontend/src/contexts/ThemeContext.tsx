"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

export type ThemeMode = "light" | "dark" | "system"
export type ResolvedThemeMode = "light" | "dark"

export const ACCENT_THEMES = [
  {
    id: "blue",
    label: "Blue",
    light: { primary: "221 83% 53%", foreground: "0 0% 98%" },
    dark: { primary: "221 83% 62%", foreground: "222 47% 11%" },
  },
  {
    id: "green",
    label: "Green",
    light: { primary: "160 84% 39%", foreground: "0 0% 98%" },
    dark: { primary: "160 70% 45%", foreground: "222 47% 11%" },
  },
  {
    id: "violet",
    label: "Violet",
    light: { primary: "262 83% 58%", foreground: "0 0% 98%" },
    dark: { primary: "262 83% 67%", foreground: "222 47% 11%" },
  },
  {
    id: "rose",
    label: "Rose",
    light: { primary: "346 77% 50%", foreground: "0 0% 98%" },
    dark: { primary: "346 77% 60%", foreground: "222 47% 11%" },
  },
  {
    id: "amber",
    label: "Amber",
    light: { primary: "38 92% 50%", foreground: "24 9.8% 10%" },
    dark: { primary: "38 92% 58%", foreground: "24 9.8% 10%" },
  },
  {
    id: "ocean",
    label: "Ocean",
    light: { primary: "199 89% 48%", foreground: "0 0% 98%" },
    dark: { primary: "199 89% 57%", foreground: "222 47% 11%" },
  },
  {
    id: "aurora",
    label: "Aurora",
    light: { primary: "173 80% 40%", foreground: "0 0% 98%" },
    dark: { primary: "172 66% 50%", foreground: "222 47% 11%" },
  },
  {
    id: "sunset",
    label: "Sunset",
    light: { primary: "21 90% 48%", foreground: "0 0% 98%" },
    dark: { primary: "21 92% 60%", foreground: "222 47% 11%" },
  },
  {
    id: "midnight",
    label: "Midnight",
    light: { primary: "243 75% 59%", foreground: "0 0% 98%" },
    dark: { primary: "239 84% 67%", foreground: "222 47% 11%" },
  },
] as const

export type ThemeAccent = typeof ACCENT_THEMES[number]["id"]

interface SurfacePalette {
  background: string
  foreground: string
  card: string
  cardForeground: string
  muted: string
  mutedForeground: string
  border: string
}

export const COLOR_THEMES: ReadonlyArray<{
  id: string
  label: string
  description: string
  light: SurfacePalette
  dark: SurfacePalette
}> = [
  {
    id: "graphite",
    label: "Graphite",
    description: "Balanced neutral grays",
    light: {
      background: "0 0% 100%",
      foreground: "0 0% 3.9%",
      card: "0 0% 100%",
      cardForeground: "0 0% 3.9%",
      muted: "0 0% 96.1%",
      mutedForeground: "0 0% 45.1%",
      border: "0 0% 89.8%",
    },
    dark: {
      background: "0 0% 3.9%",
      foreground: "0 0% 98%",
      card: "0 0% 3.9%",
      cardForeground: "0 0% 98%",
      muted: "0 0% 14.9%",
      mutedForeground: "0 0% 63.9%",
      border: "0 0% 14.9%",
    },
  },
  {
    id: "slate",
    label: "Slate",
    description: "Cool blue-tinted surfaces",
    light: {
      background: "210 40% 98%",
      foreground: "222 47% 11%",
      card: "0 0% 100%",
      cardForeground: "222 47% 11%",
      muted: "210 40% 93%",
      mutedForeground: "215 16% 44%",
      border: "214 32% 88%",
    },
    dark: {
      background: "222 47% 7%",
      foreground: "210 40% 98%",
      card: "222 44% 10%",
      cardForeground: "210 40% 98%",
      muted: "217 33% 16%",
      mutedForeground: "215 20% 65%",
      border: "217 33% 18%",
    },
  },
  {
    id: "nordic",
    label: "Nordic",
    description: "Muted arctic blue-grays",
    light: {
      background: "219 28% 95%",
      foreground: "220 16% 22%",
      card: "218 27% 99%",
      cardForeground: "220 16% 22%",
      muted: "219 28% 89%",
      mutedForeground: "220 16% 45%",
      border: "219 28% 83%",
    },
    dark: {
      background: "220 16% 14%",
      foreground: "218 27% 92%",
      card: "220 16% 18%",
      cardForeground: "218 27% 92%",
      muted: "220 16% 25%",
      mutedForeground: "219 28% 70%",
      border: "220 16% 27%",
    },
  },
  {
    id: "sandstone",
    label: "Sandstone",
    description: "Warm paper-like tones",
    light: {
      background: "40 36% 96%",
      foreground: "24 10% 10%",
      card: "40 33% 99%",
      cardForeground: "24 10% 10%",
      muted: "40 25% 90%",
      mutedForeground: "25 8% 44%",
      border: "40 20% 84%",
    },
    dark: {
      background: "24 12% 8%",
      foreground: "40 20% 92%",
      card: "24 10% 11%",
      cardForeground: "40 20% 92%",
      muted: "24 8% 17%",
      mutedForeground: "30 8% 62%",
      border: "24 8% 19%",
    },
  },
  {
    id: "onyx",
    label: "Onyx",
    description: "High contrast, pure black",
    light: {
      background: "0 0% 100%",
      foreground: "0 0% 0%",
      card: "0 0% 100%",
      cardForeground: "0 0% 0%",
      muted: "0 0% 95%",
      mutedForeground: "0 0% 35%",
      border: "0 0% 84%",
    },
    dark: {
      background: "0 0% 0%",
      foreground: "0 0% 98%",
      card: "0 0% 4%",
      cardForeground: "0 0% 98%",
      muted: "0 0% 11%",
      mutedForeground: "0 0% 62%",
      border: "0 0% 14%",
    },
  },
]

export type ThemePalette = typeof COLOR_THEMES[number]["id"]

interface ThemeSettings {
  mode: ThemeMode
  accent: ThemeAccent
  palette: ThemePalette
}

interface ThemeContextValue {
  settings: ThemeSettings
  mode: ThemeMode
  accent: ThemeAccent
  palette: ThemePalette
  resolvedMode: ResolvedThemeMode
  setMode: (mode: ThemeMode) => void
  setAccent: (accent: ThemeAccent) => void
  setPalette: (palette: ThemePalette) => void
}

const STORAGE_KEY = "meetily-theme-settings"
// Dark is the default experience; users can switch during onboarding or in settings.
const DEFAULT_THEME: ThemeSettings = { mode: "dark", accent: "blue", palette: "graphite" }

const ACCENT_BY_ID = ACCENT_THEMES.reduce((accents, accent) => {
  accents[accent.id] = accent
  return accents
}, {} as Record<ThemeAccent, typeof ACCENT_THEMES[number]>)

const PALETTE_BY_ID = COLOR_THEMES.reduce((palettes, palette) => {
  palettes[palette.id] = palette
  return palettes
}, {} as Record<ThemePalette, typeof COLOR_THEMES[number]>)

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system"
}

function isThemeAccent(value: unknown): value is ThemeAccent {
  return typeof value === "string" && value in ACCENT_BY_ID
}

function isThemePalette(value: unknown): value is ThemePalette {
  return typeof value === "string" && value in PALETTE_BY_ID
}

function getSystemMode(): ResolvedThemeMode {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function getStoredTheme(): ThemeSettings {
  if (typeof window === "undefined") return DEFAULT_THEME

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_THEME

    const parsed = JSON.parse(stored) as Partial<ThemeSettings>

    return {
      mode: isThemeMode(parsed.mode) ? parsed.mode : DEFAULT_THEME.mode,
      accent: isThemeAccent(parsed.accent) ? parsed.accent : DEFAULT_THEME.accent,
      palette: isThemePalette(parsed.palette) ? parsed.palette : DEFAULT_THEME.palette,
    }
  } catch {
    return DEFAULT_THEME
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(getStoredTheme)
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(getSystemMode)

  const resolvedMode = settings.mode === "system" ? systemMode : settings.mode

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const updateSystemMode = () => setSystemMode(mediaQuery.matches ? "dark" : "light")

    updateSystemMode()
    mediaQuery.addEventListener("change", updateSystemMode)

    return () => mediaQuery.removeEventListener("change", updateSystemMode)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const root = document.documentElement
    const accent = ACCENT_BY_ID[settings.accent][resolvedMode]
    const surfaces = PALETTE_BY_ID[settings.palette][resolvedMode]

    root.classList.toggle("dark", resolvedMode === "dark")
    root.dataset.themeMode = settings.mode
    root.dataset.themeResolved = resolvedMode
    root.dataset.themeAccent = settings.accent
    root.dataset.themePalette = settings.palette
    root.style.colorScheme = resolvedMode
    root.style.setProperty("--primary", accent.primary)
    root.style.setProperty("--primary-foreground", accent.foreground)
    root.style.setProperty("--ring", accent.primary)
    root.style.setProperty("--theme-accent", accent.primary)
    root.style.setProperty("--theme-accent-foreground", accent.foreground)

    // Surface palette: popover mirrors card; secondary/accent mirror muted; input mirrors border.
    const surfaceVars: Record<string, string> = {
      "--background": surfaces.background,
      "--foreground": surfaces.foreground,
      "--card": surfaces.card,
      "--card-foreground": surfaces.cardForeground,
      "--popover": surfaces.card,
      "--popover-foreground": surfaces.cardForeground,
      "--secondary": surfaces.muted,
      "--secondary-foreground": surfaces.foreground,
      "--muted": surfaces.muted,
      "--muted-foreground": surfaces.mutedForeground,
      "--accent": surfaces.muted,
      "--accent-foreground": surfaces.foreground,
      "--border": surfaces.border,
      "--input": surfaces.border,
    }
    Object.entries(surfaceVars).forEach(([name, hsl]) => root.style.setProperty(name, hsl))
  }, [resolvedMode, settings.accent, settings.mode, settings.palette])

  const setMode = useCallback((mode: ThemeMode) => {
    setSettings((current) => ({ ...current, mode }))
  }, [])

  const setAccent = useCallback((accent: ThemeAccent) => {
    setSettings((current) => ({ ...current, accent }))
  }, [])

  const setPalette = useCallback((palette: ThemePalette) => {
    setSettings((current) => ({ ...current, palette }))
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({
    settings,
    mode: settings.mode,
    accent: settings.accent,
    palette: settings.palette,
    resolvedMode,
    setMode,
    setAccent,
    setPalette,
  }), [settings, resolvedMode, setMode, setAccent, setPalette])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
