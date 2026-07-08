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
] as const

export type ThemeAccent = typeof ACCENT_THEMES[number]["id"]

interface ThemeSettings {
  mode: ThemeMode
  accent: ThemeAccent
}

interface ThemeContextValue {
  settings: ThemeSettings
  mode: ThemeMode
  accent: ThemeAccent
  resolvedMode: ResolvedThemeMode
  setMode: (mode: ThemeMode) => void
  setAccent: (accent: ThemeAccent) => void
}

const STORAGE_KEY = "meetily-theme-settings"
const DEFAULT_THEME: ThemeSettings = { mode: "system", accent: "blue" }

const ACCENT_BY_ID = ACCENT_THEMES.reduce((accents, accent) => {
  accents[accent.id] = accent
  return accents
}, {} as Record<ThemeAccent, typeof ACCENT_THEMES[number]>)

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system"
}

function isThemeAccent(value: unknown): value is ThemeAccent {
  return typeof value === "string" && value in ACCENT_BY_ID
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

    root.classList.toggle("dark", resolvedMode === "dark")
    root.dataset.themeMode = settings.mode
    root.dataset.themeResolved = resolvedMode
    root.dataset.themeAccent = settings.accent
    root.style.colorScheme = resolvedMode
    root.style.setProperty("--primary", accent.primary)
    root.style.setProperty("--primary-foreground", accent.foreground)
    root.style.setProperty("--ring", accent.primary)
    root.style.setProperty("--theme-accent", accent.primary)
    root.style.setProperty("--theme-accent-foreground", accent.foreground)
  }, [resolvedMode, settings.accent, settings.mode])

  const setMode = useCallback((mode: ThemeMode) => {
    setSettings((current) => ({ ...current, mode }))
  }, [])

  const setAccent = useCallback((accent: ThemeAccent) => {
    setSettings((current) => ({ ...current, accent }))
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({
    settings,
    mode: settings.mode,
    accent: settings.accent,
    resolvedMode,
    setMode,
    setAccent,
  }), [settings, resolvedMode, setMode, setAccent])

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
