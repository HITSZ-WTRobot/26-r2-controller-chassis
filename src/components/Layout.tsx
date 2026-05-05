import { ConnectionPanel } from './ConnectionPanel';
import { StatusDisplay } from './StatusDisplay';
import { ActionStatePanel } from './ActionStatePanel';
import { ConnectionMap } from './ConnectionMap';
import { HeightControl, StepControl, GripControl, SystemControl } from './ControlPanel';
import { WasdVelocityControl } from './WasdVelocityControl';
import { Tabs } from './Tabs';
import type { RobotState } from '../types/robot';

interface LayoutProps {
  state: RobotState | null;
}

export function Layout({ state }: LayoutProps) {
  const tabs = [
    {
      id: 'chassis',
      label: '底盘控制',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WasdVelocityControl />
          <HeightControl />
        </div>
      ),
    },
    {
      id: 'step',
      label: '台阶控制',
      content: <StepControl />,
    },
    {
      id: 'grip',
      label: '夹爪控制',
      content: <GripControl />,
    },
    {
      id: 'system',
      label: '系统',
      content: <SystemControl />,
    },
  ];

  return (
    <div className="min-h-screen bg-bg p-3 sm:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-text">R2 控制端</h1>
          <p className="text-sm text-text-secondary">Robocon 2026 独立升降麦轮底盘</p>
        </header>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            <ConnectionPanel />
            <StatusDisplay state={state} />
            <ActionStatePanel actionState={state?.action_state ?? null} />
            <ConnectionMap connectionState={state?.connection_state ?? null} />
          </div>

          <Tabs tabs={tabs} defaultTab="chassis" />
        </div>
      </div>
    </div>
  );
}
