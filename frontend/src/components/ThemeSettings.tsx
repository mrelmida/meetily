"use client"

import { Check, Monitor, Moon, Sun } from "lucide-react"
import { ACCENT_THEMES, COLOR_THEMES, ThemeMode, useTheme } from "@/contexts/ThemeContext"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { cn } from "@/lib/utils"

const THEME_MODES: Array<{ value: ThemeMode; label: string; icon: typeof Monitor }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
]

export function ThemeSettings() {
  const { mode, accent, palette, resolvedMode, setMode, setAccent, setPalette } = useTheme()

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
          <Label className="text-foreground">Color theme</Label>
          <div className="grid grid-cols-5 gap-2">
            {COLOR_THEMES.map((option) => {
              const selected = palette === option.id
              const surfaces = option[resolvedMode]

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPalette(option.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                    selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"
                  )}
                  aria-pressed={selected}
                  title={option.description}
                >
                  <div
                    className="relative h-9 w-full overflow-hidden rounded-md border"
                    style={{
                      backgroundColor: `hsl(${surfaces.background})`,
                      borderColor: `hsl(${surfaces.border})`,
                    }}
                  >
                    <div
                      className="absolute inset-x-1.5 bottom-1.5 top-2.5 rounded-sm border"
                      style={{
                        backgroundColor: `hsl(${surfaces.card})`,
                        borderColor: `hsl(${surfaces.border})`,
                      }}
                    >
                      <div
                        className="mx-1 mt-1 h-1 w-2/3 rounded-full"
                        style={{ backgroundColor: `hsl(${surfaces.mutedForeground})` }}
                      />
                    </div>
                    {selected && (
                      <div className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-2 w-2 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-card-foreground">{option.label}</span>
                </button>
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
