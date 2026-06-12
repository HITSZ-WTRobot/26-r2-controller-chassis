import { ConnectionPanel } from './ConnectionPanel';
import { StatusDisplay } from './StatusDisplay';
import { ActionStatePanel } from './ActionStatePanel';
import { ConnectionMap } from './ConnectionMap';
import { HeightControl, StepControl, StepPoseControl, GripControl, SystemControl, PostureControl } from './ControlPanel';
import { WasdVelocityControl } from './WasdVelocityControl';
import { Tabs } from './Tabs';
import { SerialDebugger } from './SerialDebugger';
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
          <HeightControl state={state} />
        </div>
      ),
    },
    {
      id: 'posture',
      label: '位姿控制',
      content: <PostureControl state={state} />,
    },
    {
      id: 'step',
      label: '台阶控制',
      content: <div className="space-y-6"><StepControl /><StepPoseControl /></div>,
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
      <div className="mx-auto max-w-[1600px] flex flex-col xl:flex-row gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <header>
            <h1 className="text-xl sm:text-2xl font-bold text-text">R2 控制端</h1>
            <p className="text-sm text-text-secondary">Robocon 2026 独立升降麦轮底盘</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            <ConnectionPanel />
            <StatusDisplay state={state} />
            <ActionStatePanel actionState={state?.action_state ?? null} />
            <ConnectionMap connectionState={state?.connection_state ?? null} />
          </div>

          <Tabs tabs={tabs} defaultTab="chassis" />
        </div>

        <aside className="hidden xl:flex xl:flex-col w-[38rem] shrink-0 sticky top-4 self-start max-h-[calc(100vh-2rem)]">
          <SerialDebugger />
        </aside>
      </div>
    </div>
  );
}
