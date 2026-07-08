"use client"

import { Check, Monitor, Moon, Sun } from "lucide-react"
import { ACCENT_THEMES, ThemeMode, useTheme } from "@/contexts/ThemeContext"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { cn } from "@/lib/utils"

const THEME_MODES: Array<{ value: ThemeMode; label: string; icon: typeof Monitor }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
]

export function ThemeSettings() {
  const { mode, accent, setMode, setAccent } = useTheme()

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-card-foreground">Appearance</h3>

      <div className="space-y-5">
        <div className="space-y-3">
          <Label className="text-foreground">Theme</Label>
          <div className="grid grid-cols-3 gap-2">
            {THEME_MODES.map((option) => {
              const Icon = option.icon
              const selected = mode === option.value

              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  className="h-10 justify-center"
                  onClick={() => setMode(option.value)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{option.label}</span>
                </Button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-foreground">Accent</Label>
          <div className="flex flex-wrap gap-3">
            {ACCENT_THEMES.map((option) => {
              const selected = accent === option.id

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAccent(option.id)}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full border border-border shadow-sm ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected && "ring-2 ring-ring ring-offset-2"
                  )}
                  style={{ backgroundColor: `hsl(${option.light.primary})` }}
                  aria-label={`${option.label} accent`}
                  title={option.label}
                >
                  {selected && (
                    <Check
                      className={cn(
                        "h-4 w-4",
                        option.id === "amber" ? "text-zinc-950" : "text-white"
                      )}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
