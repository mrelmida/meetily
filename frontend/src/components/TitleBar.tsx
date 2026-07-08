'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Mic, Minus, Square, Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ResizeDirection =
  | 'North'
  | 'South'
  | 'East'
  | 'West'
  | 'NorthEast'
  | 'NorthWest'
  | 'SouthEast'
  | 'SouthWest';

async function withWindow(action: (w: import('@tauri-apps/api/window').Window) => Promise<void>) {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await action(getCurrentWindow());
  } catch (e) {
    // Not running inside Tauri (e.g. plain browser dev) - window controls are no-ops
    console.warn('[TitleBar] Window action failed:', e);
  }
}

/**
 * Invisible edge/corner strips that restore window resizing on Linux,
 * where undecorated windows lose their native resize borders.
 */
function ResizeHandles() {
  const startResize = (direction: ResizeDirection) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    withWindow((w) => w.startResizeDragging(direction));
  };

  const zones: Array<{ direction: ResizeDirection; className: string }> = [
    { direction: 'North', className: 'top-0 inset-x-2 h-1 cursor-n-resize' },
    { direction: 'South', className: 'bottom-0 inset-x-2 h-1 cursor-s-resize' },
    { direction: 'West', className: 'left-0 inset-y-2 w-1 cursor-w-resize' },
    { direction: 'East', className: 'right-0 inset-y-2 w-1 cursor-e-resize' },
    { direction: 'NorthWest', className: 'top-0 left-0 h-2 w-2 cursor-nw-resize' },
    { direction: 'NorthEast', className: 'top-0 right-0 h-2 w-2 cursor-ne-resize' },
    { direction: 'SouthWest', className: 'bottom-0 left-0 h-2 w-2 cursor-sw-resize' },
    { direction: 'SouthEast', className: 'bottom-0 right-0 h-2 w-2 cursor-se-resize' },
  ];

  return (
    <>
      {zones.map((zone) => (
        <div
          key={zone.direction}
          onMouseDown={startResize(zone.direction)}
          className={cn('fixed z-[110]', zone.className)}
        />
      ))}
    </>
  );
}

function WindowControlButton({
  onClick,
  label,
  danger = false,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-full w-11 place-items-center text-muted-foreground transition-colors duration-150',
        danger
          ? 'hover:bg-red-500 hover:text-white active:bg-red-600'
          : 'hover:bg-accent hover:text-foreground active:bg-muted'
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLinux, setIsLinux] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const setup = async () => {
      try {
        const { platform } = await import('@tauri-apps/plugin-os');
        if (!cancelled) setIsLinux(platform() === 'linux');
      } catch {
        // Plain browser - leave defaults
      }

      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const w = getCurrentWindow();
        const maximized = await w.isMaximized();
        if (!cancelled) setIsMaximized(maximized);

        const stop = await w.onResized(async () => {
          const m = await w.isMaximized();
          if (!cancelled) setIsMaximized(m);
        });
        if (cancelled) {
          stop();
        } else {
          unlisten = stop;
        }
      } catch {
        // Plain browser - no window events
      }
    };

    setup();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const minimize = useCallback(() => withWindow((w) => w.minimize()), []);
  const toggleMaximize = useCallback(() => withWindow((w) => w.toggleMaximize()), []);
  const close = useCallback(() => withWindow((w) => w.close()), []);

  return (
    <>
      <header
        data-tauri-drag-region
        className="fixed inset-x-0 top-0 z-[100] flex h-10 select-none items-center justify-between border-b border-border bg-background/90 backdrop-blur-md"
      >
        {/* App identity (clicks fall through to the drag region) */}
        <div className="pointer-events-none flex items-center gap-2.5 pl-3.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary shadow-sm">
            <Mic className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            Meetily
          </span>
        </div>

        {/* Window controls */}
        <div className="flex h-full items-stretch">
          <WindowControlButton onClick={minimize} label="Minimize">
            <Minus className="h-4 w-4" strokeWidth={1.75} />
          </WindowControlButton>
          <WindowControlButton
            onClick={toggleMaximize}
            label={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <Square className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </WindowControlButton>
          <WindowControlButton onClick={close} label="Close" danger>
            <X className="h-4 w-4" strokeWidth={1.75} />
          </WindowControlButton>
        </div>
      </header>

      {isLinux && !isMaximized && <ResizeHandles />}
    </>
  );
}
