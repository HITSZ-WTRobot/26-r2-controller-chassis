import type { RobotState } from '../types/robot';

interface StatusDisplayProps {
  state: RobotState | null;
}

const FIELDS = [
  { key: 'x', label: 'X', unit: 'm', format: (v: number) => v.toFixed(3) },
  { key: 'y', label: 'Y', unit: 'm', format: (v: number) => v.toFixed(3) },
  { key: 'yaw', label: '航向角', unit: '°', format: (v: number) => v.toFixed(2) },
  { key: 'front_height', label: '前高度', unit: 'm', format: (v: number) => v.toFixed(3) },
  { key: 'rear_height', label: '后高度', unit: 'm', format: (v: number) => v.toFixed(3) },
  { key: 'timestamp', label: '时间戳', unit: '', format: (v: number) => String(v) },
] as const;

export function StatusDisplay({ state }: StatusDisplayProps) {
  return (
    <div className="bg-surface rounded-lg shadow p-4 border border-border">
      <h2 className="text-lg font-semibold mb-4 text-text">机器人状态</h2>
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map((f) => {
          const value = state ? state[f.key] as number : null;
          const spanClass = f.key === 'timestamp' ? 'col-span-2' : '';
          return (
            <div
              key={f.key}
              className={`p-2 rounded border border-border ${spanClass} ${state ? 'bg-bg' : 'bg-bg/50'}`}
            >
              <span className="text-xs text-text-secondary block">{f.label}</span>
              {value === null ? (
                <span className="font-mono text-sm font-semibold text-text-secondary inline-block">
                  <span className="inline-block w-16 h-4 rounded bg-border animate-pulse align-middle" />
                  {f.unit && <span className="ml-1 align-middle">{f.unit}</span>}
                </span>
              ) : (
                <span className="font-mono text-sm font-semibold text-text whitespace-nowrap">
                  {f.format(value)}{f.unit && ` ${f.unit}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
