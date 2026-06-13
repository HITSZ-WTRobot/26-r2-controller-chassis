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
  {
    label: '红外接收',
    get: (s) => {
      const map: Record<string, string> = {
        KeepAlive: '保活 (0xA0)',
        DockingComplete: '对接完成 (0xA1)',
        NoAction: '无动作 (0xA2)',
        Reserved: '预留 (0xA3)',
      };
      return map[s.infrared_receiver_state] ?? s.infrared_receiver_state;
    },
  },
];

export function ActionStatePanel({ actionState }: ActionStatePanelProps) {
  return (
    <div className="bg-surface rounded-lg shadow p-3 border border-border">
      <h2 className="text-base font-semibold mb-3 text-text">动作状态</h2>
      <div className="space-y-1.5">
        {ROWS.map((row) => (
          <div key={row.label} className="flex justify-between items-center py-0.5 border-b border-border last:border-0">
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
