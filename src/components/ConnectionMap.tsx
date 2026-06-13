import type { ConnectionState } from '../types/robot';

interface ConnectionMapProps {
  connectionState: ConnectionState | null;
}

const ITEMS: { label: string; key: keyof ConnectionState }[] = [
  { label: '轮组 0', key: 'wheel_0' },
  { label: '轮组 1', key: 'wheel_1' },
  { label: '轮组 2', key: 'wheel_2' },
  { label: '轮组 3', key: 'wheel_3' },
  { label: '升降 0', key: 'lift_0' },
  { label: '升降 1', key: 'lift_1' },
  { label: '升降 2', key: 'lift_2' },
  { label: '升降 3', key: 'lift_3' },
  { label: '夹爪臂', key: 'grip_arm' },
  { label: '夹爪转', key: 'grip_turn' },
  { label: '陀螺仪', key: 'gyro_yaw' },
  { label: '夹爪吸盘压力', key: 'grip_suction_pressure' },
  { label: '腹部吸盘压力', key: 'abdomen_suction_pressure' },
  { label: '定位', key: 'upper_host_localization' },
  { label: '上位机', key: 'upper_host' },
];

export function ConnectionMap({ connectionState }: ConnectionMapProps) {
  return (
    <div className="bg-surface rounded-lg shadow p-3 border border-border">
      <h2 className="text-base font-semibold mb-3 text-text">连接状态图</h2>
      <div className="grid grid-cols-2 gap-1.5">
        {ITEMS.map((item) => {
          const online = connectionState ? connectionState[item.key] : null;
          return (
            <div key={item.key} className="flex items-center gap-1.5">
              {online === null ? (
                <div className="w-3 h-3 rounded-full bg-border animate-pulse" />
              ) : (
                <div className={`w-3 h-3 rounded-full ${online ? 'bg-success' : 'bg-danger'}`} />
              )}
              <span className="text-sm text-text">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
