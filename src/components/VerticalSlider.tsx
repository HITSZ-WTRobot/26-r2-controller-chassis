import { useRef, useCallback } from 'react';

interface VerticalSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  height?: number;
  disabled?: boolean;
}

export function VerticalSlider({
  value,
  min,
  max,
  step = 0.001,
  onChange,
  height = 224,
  disabled = false,
}: VerticalSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const snap = (v: number) => {
    const snapped = Math.round((v - min) / step) * step + min;
    return Number(clamp(snapped).toFixed(6));
  };

  const updateFromY = useCallback(
    (clientY: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = 1 - (clientY - rect.top) / rect.height;
      const raw = min + ratio * (max - min);
      onChange(snap(raw));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max, step, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (disabled) return;
    const target = e.target as HTMLElement;
    if (!target.hasPointerCapture(e.pointerId)) return;
    updateFromY(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    let next = value;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = value + step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = value - step;
    else if (e.key === 'PageUp') next = value + step * 10;
    else if (e.key === 'PageDown') next = value - step * 10;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else return;
    e.preventDefault();
    onChange(snap(next));
  };

  const pct = ((clamp(value) - min) / (max - min)) * 100;
  const fillHeight = `${pct}%`;
  const thumbBottom = `calc(${pct}% - 0.5rem)`;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-orientation="vertical"
      aria-disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      style={{ height: `${height}px` }}
      className={`relative w-2 rounded-full select-none touch-none focus:outline-none focus:ring-2 focus:ring-primary ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } bg-border`}
    >
      <div
        className="absolute bottom-0 left-0 right-0 rounded-full bg-primary pointer-events-none"
        style={{ height: fillHeight }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-surface shadow pointer-events-none"
        style={{ bottom: thumbBottom }}
      />
    </div>
  );
}
