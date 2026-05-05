import type { ActionState } from '../types/robot';

interface ActionStatePanelProps {
  actionState: ActionState | null;
}

interface Row {
  label: string;
  get: (s: ActionState) => string;
  highlight?: (s: ActionState) => string;
}

const ROWS: Row[] = [
  { label: '台阶状态', get: (s) => s.step_status },
  { label: '底盘模式', get: (s) => s.chassis_mode },
  {
    label: '曲线完成',
    get: (s) => (s.chassis_curve_finished ? '是' : '否'),
    highlight: (s) => (s.chassis_curve_finished ? 'text-success' : 'text-danger'),
  },
  { label: '升降状态', get: (s) => s.lift_status },
  { label: '夹爪状态', get: (s) => s.grip_status },
  {
    label: '吸盘有物',
    get: (s) => (s.grip_suction_has_object ? '是' : '否'),
    highlight: (s) => (s.grip_suction_has_object ? 'text-success' : 'text-text-secondary'),
  },
];

export function ActionStatePanel({ actionState }: ActionStatePanelProps) {
  return (
    <div className="bg-surface rounded-lg shadow p-4 border border-border">
      <h2 className="text-lg font-semibold mb-4 text-text">动作状态</h2>
      <div className="space-y-2">
        {ROWS.map((row) => (
          <div key={row.label} className="flex justify-between items-center py-1 border-b border-border last:border-0">
            <span className="text-text-secondary">{row.label}</span>
            {actionState ? (
              <span className={`font-mono ${row.highlight?.(actionState) ?? 'text-text'}`}>
                {row.get(actionState)}
              </span>
            ) : (
              <span className="inline-block w-20 h-4 rounded bg-border animate-pulse" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
