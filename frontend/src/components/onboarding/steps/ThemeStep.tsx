import React, { useEffect, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnboardingContainer } from '../OnboardingContainer';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ACCENT_THEMES, COLOR_THEMES, ThemeMode, useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const MODE_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Moon;
}> = [
  { value: 'dark', label: 'Dark', description: 'Recommended', icon: Moon },
  { value: 'light', label: 'Light', description: 'Bright & clean', icon: Sun },
  { value: 'system', label: 'System', description: 'Match your OS', icon: Monitor },
];

interface PreviewPalette {
  bg: string;
  surface: string;
  line: string;
  text: string;
}

const PREVIEW_PALETTES: Record<'dark' | 'light', PreviewPalette> = {
  dark: { bg: '#0a0a0a', surface: '#1f1f1f', line: '#3f3f3f', text: '#a3a3a3' },
  light: { bg: '#fafafa', surface: '#ffffff', line: '#e5e5e5', text: '#9ca3af' },
};

function ModePreviewSurface({
  palette,
  accentColor,
}: {
  palette: PreviewPalette;
  accentColor: string;
}) {
  return (
    <div className="absolute inset-0 p-2" style={{ backgroundColor: palette.bg }}>
      {/* Mock window */}
      <div
        className="h-full w-full rounded-md border p-1.5 flex gap-1.5"
        style={{ backgroundColor: palette.surface, borderColor: palette.line }}
      >
        {/* Mock sidebar */}
        <div
          className="w-1/4 rounded-sm flex flex-col gap-1 p-1"
          style={{ backgroundColor: palette.bg }}
        >
          <div className="h-1 rounded-full" style={{ backgroundColor: accentColor }} />
          <div className="h-1 rounded-full" style={{ backgroundColor: palette.line }} />
          <div className="h-1 rounded-full" style={{ backgroundColor: palette.line }} />
        </div>
        {/* Mock content */}
        <div className="flex-1 flex flex-col gap-1 p-1">
          <div className="h-1.5 w-3/5 rounded-full" style={{ backgroundColor: palette.text }} />
          <div className="h-1 w-full rounded-full" style={{ backgroundColor: palette.line }} />
          <div className="h-1 w-4/5 rounded-full" style={{ backgroundColor: palette.line }} />
          <div className="mt-auto flex justify-end">
            <div className="h-2.5 w-8 rounded-sm" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModePreview({ mode, accentColor }: { mode: ThemeMode; accentColor: string }) {
  if (mode === 'system') {
    // Split preview: left half dark, right half light
    return (
      <div className="relative h-20 w-full overflow-hidden rounded-md">
        <ModePreviewSurface palette={PREVIEW_PALETTES.dark} accentColor={accentColor} />
        <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-[200%]">
            <ModePreviewSurface palette={PREVIEW_PALETTES.light} accentColor={accentColor} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-20 w-full overflow-hidden rounded-md">
      <ModePreviewSurface palette={PREVIEW_PALETTES[mode]} accentColor={accentColor} />
    </div>
  );
}

export function ThemeStep() {
  const { goNext } = useOnboarding();
  const { mode, accent, palette, resolvedMode, setMode, setAccent, setPalette } = useTheme();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const { platform } = await import('@tauri-apps/plugin-os');
        setIsMac(platform() === 'macos');
      } catch (e) {
        setIsMac(navigator.userAgent.includes('Mac'));
      }
    };
    checkPlatform();
  }, []);

  const selectedAccent = ACCENT_THEMES.find((option) => option.id === accent) ?? ACCENT_THEMES[0];

  return (
    <OnboardingContainer
      title="Make it yours"
      description="Pick a look for Meetily. You can change this anytime in settings."
      step={2}
      totalSteps={isMac ? 5 : 4}
    >
      <div className="flex flex-col items-center space-y-8">
        {/* Mode Selection */}
        <div className="w-full max-w-lg grid grid-cols-3 gap-3">
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = mode === option.value;
            // Preview the accent in the variant that matches the previewed mode
            const previewAccent =
              option.value === 'light' ? selectedAccent.light.primary : selectedAccent.dark.primary;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={cn(
                  'group rounded-xl border bg-card p-2 text-left transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                  selected
                    ? 'border-primary ring-2 ring-primary shadow-md'
                    : 'border-border hover:border-primary/50 hover:shadow-sm'
                )}
                aria-pressed={selected}
              >
                <ModePreview mode={option.value} accentColor={`hsl(${previewAccent})`} />
                <div className="mt-2 flex items-center justify-between px-1 pb-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                  </div>
                  {selected && (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <p className="px-1 pb-1 text-xs text-muted-foreground">{option.description}</p>
              </button>
            );
          })}
        </div>

        {/* Color Theme Selection */}
        <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5">
          <p className="mb-4 text-sm font-medium text-foreground">Color theme</p>
          <div className="grid grid-cols-5 gap-2">
            {COLOR_THEMES.map((option) => {
              const selected = palette === option.id;
              const surfaces = option[resolvedMode];

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPalette(option.id)}
                  className={cn(
                    'group flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                    selected
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border hover:border-primary/50'
                  )}
                  aria-pressed={selected}
                  title={option.description}
                >
                  <div
                    className="relative h-10 w-full overflow-hidden rounded-md border"
                    style={{
                      backgroundColor: `hsl(${surfaces.background})`,
                      borderColor: `hsl(${surfaces.border})`,
                    }}
                  >
                    <div
                      className="absolute inset-x-1.5 bottom-1.5 top-3 rounded-sm border"
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
                  <span className="text-[11px] font-medium text-foreground">{option.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sets the tone of backgrounds, cards, and borders.
          </p>
        </div>

        {/* Accent Selection */}
        <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5">
          <p className="mb-4 text-sm font-medium text-foreground">Accent color</p>
          <div className="flex flex-wrap items-center gap-3">
            {ACCENT_THEMES.map((option) => {
              const selected = accent === option.id;
              const swatch = option[resolvedMode].primary;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAccent(option.id)}
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-full border border-border shadow-sm transition',
                    'ring-offset-background hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    selected && 'ring-2 ring-ring ring-offset-2'
                  )}
                  style={{ backgroundColor: `hsl(${swatch})` }}
                  aria-label={`${option.label} accent`}
                  title={option.label}
                >
                  {selected && (
                    <Check
                      className={cn(
                        'h-4 w-4',
                        option.id === 'amber' ? 'text-zinc-950' : 'text-white'
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {selectedAccent.label} — buttons, highlights, and progress bars use this color.
          </p>
        </div>

        {/* CTA */}
        <div className="w-full max-w-xs">
          <Button onClick={goNext} className="w-full h-11">
            Continue
          </Button>
        </div>
      </div>
    </OnboardingContainer>
  );
}
