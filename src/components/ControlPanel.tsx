import { useState, useRef, useCallback } from 'react';
import { useCommand } from '../hooks/useSerial';
import { VerticalSlider } from './VerticalSlider';
import type { RobotState } from '../types/robot';

const HEIGHT_MIN = 0.207;
const HEIGHT_MAX = 0.6152;
const HEIGHT_STEP = 0.005;
const LINK_MODE_PREVIOUS_CURVE = 2;
const SEND_THROTTLE_MS = 40;

const LIFT_V_DEFAULT = 1.0;
const LIFT_V_MAX_LIMIT = 1.178;
const LIFT_A_DEFAULT = 5.0;
const LIFT_A_MAX_LIMIT = 5.0;

interface HeightControlProps {
  state: RobotState | null;
}

export function HeightControl({ state }: HeightControlProps) {
  const { send } = useCommand();
  const [height, setHeight] = useState(HEIGHT_MIN);
  const [vMax, setVMax] = useState(LIFT_V_DEFAULT);
  const [aMax, setAMax] = useState(LIFT_A_DEFAULT);
  const [immediateSend, setImmediateSend] = useState(true);

  const lastSendTs = useRef(0);
  const pendingTimer = useRef<number | null>(null);
  const latestParams = useRef({ height: HEIGHT_MIN, vMax: LIFT_V_DEFAULT, aMax: LIFT_A_DEFAULT });

  const clamp = (v: number) => Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, v));
  const clampRange = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const doSend = useCallback(async () => {
    lastSendTs.current = Date.now();
    const { height, vMax, aMax } = latestParams.current;
    try {
      await send({
        type: 'SetChassisHeight',
        height,
        v_max: vMax,
        a_max: aMax,
        j_max: 0,
        link_mode: LINK_MODE_PREVIOUS_CURVE,
      });
    } catch (e) {
      console.error(e);
    }
  }, [send]);

  const scheduleSend = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastSendTs.current;
    if (pendingTimer.current !== null) {
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
    if (elapsed >= SEND_THROTTLE_MS) {
      doSend();
    } else {
      pendingTimer.current = window.setTimeout(() => {
        pendingTimer.current = null;
        doSend();
      }, SEND_THROTTLE_MS - elapsed);
    }
  }, [doSend]);

  const handleHeightChange = (v: number) => {
    const c = clamp(v);
    setHeight(c);
    latestParams.current.height = c;
    if (immediateSend) scheduleSend();
  };

  const handleVMaxChange = (v: number) => {
    const c = clampRange(v, 0, LIFT_V_MAX_LIMIT);
    setVMax(c);
    latestParams.current.vMax = c;
  };

  const handleAMaxChange = (v: number) => {
    const c = clampRange(v, 0, LIFT_A_MAX_LIMIT);
    setAMax(c);
    latestParams.current.aMax = c;
  };

  const handleUseCurrentHeight = () => {
    if (state) {
      const h = clamp(state.front_height);
      setHeight(h);
      latestParams.current.height = h;
      if (immediateSend) scheduleSend();
    }
  };

  const handleManualSend = () => {
    doSend();
  };

  const pct = ((height - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">底盘高度控制</h3>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer select-none">
          <span>即时发送</span>
          <button
            type="button"
            role="switch"
            aria-checked={immediateSend}
            onClick={() => setImmediateSend(!immediateSend)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              immediateSend ? 'bg-primary' : 'bg-gray-500'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                immediateSend ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
      </div>
      <div className="flex gap-3 items-stretch">
        <div className="flex flex-col items-center gap-1.5 shrink-0 py-0.5">
          <span className="text-xs text-text-secondary font-mono">{HEIGHT_MAX.toFixed(3)}</span>
          <VerticalSlider
            value={height}
            min={HEIGHT_MIN}
            max={HEIGHT_MAX}
            step={HEIGHT_STEP}
            onChange={handleHeightChange}
            height={224}
          />
          <span className="text-xs text-text-secondary font-mono">{HEIGHT_MIN.toFixed(3)}</span>
        </div>

        <div className="flex-1 space-y-2">
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-sm text-text-secondary">
                当前高度 <span className="font-mono text-text">{height.toFixed(3)} m</span>
                <span className="ml-1.5 text-text-secondary">({pct.toFixed(0)}%)</span>
              </label>
              <button
                type="button"
                onClick={handleUseCurrentHeight}
                disabled={!state}
                className="text-xs px-2 py-0.5 rounded border border-border bg-surface text-text-secondary hover:text-text hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                使用当前
              </button>
            </div>
            <input
              type="number"
              step={HEIGHT_STEP}
              min={HEIGHT_MIN}
              max={HEIGHT_MAX}
              value={height}
              onChange={(e) => handleHeightChange(parseFloat(e.target.value) || HEIGHT_MIN)}
              className="w-full border border-border rounded px-2 py-1 bg-surface text-text"
            />
          </div>
          <SliderRow
            label="最大速度"
            unit="m/s"
            value={vMax}
            onChange={handleVMaxChange}
            min={0}
            max={LIFT_V_MAX_LIMIT}
            step={0.01}
          />
          <SliderRow
            label="最大加速度"
            unit="m/s²"
            value={aMax}
            onChange={handleAMaxChange}
            min={0}
            max={LIFT_A_MAX_LIMIT}
            step={0.05}
          />
          {!immediateSend && (
            <button
              type="button"
              onClick={handleManualSend}
              className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover w-full text-sm"
            >
              发送
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        高度 {HEIGHT_MIN}–{HEIGHT_MAX} m · 速度上限 {LIFT_V_MAX_LIMIT} m/s · 加速度上限 {LIFT_A_MAX_LIMIT} m/s² · link_mode = PreviousCurve
      </p>
    </div>
  );
}

export function StepControl() {
  const { send } = useCommand();
  const [startDist, setStartDist] = useState(0.5);
  const [endDist, setEndDist] = useState(0.5);
  const [direction, setDirection] = useState(0);
  const [stepHeight, setStepHeight] = useState<'200mm' | '400mm'>('200mm');
  const [endHeight, setEndHeight] = useState(0);

  const handleStepUp = async () => {
    const type = stepHeight === '200mm' ? 'StepUp200' : 'StepUp400';
    await send({ type, start_distance: startDist, end_distance: endDist, direction, end_height: endHeight });
  };

  const handleStepDown = async () => {
    const type = stepHeight === '200mm' ? 'StepDown200' : 'StepDown400';
    await send({ type, start_distance: startDist, end_distance: endDist, direction, end_height: endHeight });
  };

  const handleStepUpResume = async () => {
    await send({ type: 'StepUpResume' });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text">台阶控制</h3>
      <div className="space-y-2">
        <InputRow label="起始距离 (m)" value={startDist} onChange={setStartDist} step={0.01} />
        <InputRow label="结束距离 (m)" value={endDist} onChange={setEndDist} step={0.01} />
        <div>
          <label className="text-sm text-text-secondary block mb-0.5">方向</label>
          <RadioGroup
            value={direction}
            onChange={setDirection}
            options={[
              { value: 0, label: '前进' },
              { value: 1, label: '后退' },
            ]}
          />
        </div>
        <div>
          <label className="text-sm text-text-secondary block mb-0.5">台阶高度</label>
          <RadioGroup
            value={stepHeight}
            onChange={setStepHeight}
            options={[
              { value: '200mm', label: '200mm' },
              { value: '400mm', label: '400mm' },
            ]}
          />
        </div>
        <div>
          <label className="text-sm text-text-secondary block mb-0.5">动作结束后底盘高度</label>
          <RadioGroup
            value={endHeight}
            onChange={setEndHeight}
            options={[
              { value: 0, label: 'Low (0.22m)' },
              { value: 1, label: 'High (0.42m)' },
            ]}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={handleStepUp}
          className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover text-sm"
        >
          登上
        </button>
        <button
          onClick={handleStepDown}
          className="bg-gray-500 text-white px-3 py-1.5 rounded hover:bg-gray-600 text-sm"
        >
          走下
        </button>
        <button
          onClick={handleStepUpResume}
          className="bg-gray-500 text-white px-3 py-1.5 rounded hover:bg-gray-600 text-sm"
        >
          继续登
        </button>
      </div>
    </div>
  );
}

export function StepUpR1Control() {
  const { send } = useCommand();
  const [stepTargetX, setStepTargetX] = useState(0);
  const [stepTargetY, setStepTargetY] = useState(0);
  const [stepTargetYaw, setStepTargetYaw] = useState(0);
  const [direction, setDirection] = useState(0);

  const handleSend = async () => {
    try {
      await send({
        type: 'StepUpR1',
        step_target_x: stepTargetX,
        step_target_y: stepTargetY,
        step_target_yaw: stepTargetYaw,
        direction,
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text">R1 台阶 (StepUpR1 0x35)</h3>

      <div>
        <label className="text-sm text-text-secondary block mb-0.5">方向</label>
        <RadioGroup
          value={direction}
          onChange={setDirection}
          options={[
            { value: 0, label: '前进' },
            { value: 1, label: '后退' },
          ]}
        />
      </div>

      <div>
        <label className="text-sm text-text-secondary block mb-0.5">台阶作业点 (世界系)</label>
        <div className="grid grid-cols-3 gap-1.5">
          <NumField label="X (m)" step={0.01} value={stepTargetX} onChange={setStepTargetX} />
          <NumField label="Y (m)" step={0.01} value={stepTargetY} onChange={setStepTargetY} />
          <NumField label="Yaw (°)" step={0.1} value={stepTargetYaw} onChange={setStepTargetYaw} />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSend}
        className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover w-full"
      >
        发送 StepUpR1
      </button>

      <p className="text-xs text-text-secondary">
        终点由下位机内部配置常量 (UpR1EndRelativePos) 相对 stepTargetPos 生成，结束 lift 目标高度固定为 0.100m
      </p>
    </div>
  );
}

export function StepPoseControl() {
  const { send } = useCommand();
  const [stepType, setStepType] = useState(0);
  const [direction, setDirection] = useState(0);
  const [stepHeight, setStepHeight] = useState(0);
  const [finalHeight, setFinalHeight] = useState(0);
  const [stepTargetX, setStepTargetX] = useState(0);
  const [stepTargetY, setStepTargetY] = useState(0);
  const [stepTargetYaw, setStepTargetYaw] = useState(0);
  const [endX, setEndX] = useState(0);
  const [endY, setEndY] = useState(0);
  const [endYaw, setEndYaw] = useState(0);

  const handleSend = async () => {
    try {
      await send({
        type: 'StepPose',
        step_type: stepType,
        direction,
        step_height: stepHeight,
        final_height: finalHeight,
        step_target_x: stepTargetX,
        step_target_y: stepTargetY,
        step_target_yaw: stepTargetYaw,
        end_x: endX,
        end_y: endY,
        end_yaw: endYaw,
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text">世界系台阶 (StepPose 0x50-0x5F)</h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-sm text-text-secondary block mb-0.5">动作类型</label>
          <RadioGroup
            value={stepType}
            onChange={setStepType}
            options={[
              { value: 0, label: '上台阶' },
              { value: 1, label: '下台阶' },
            ]}
          />
        </div>
        <div>
          <label className="text-sm text-text-secondary block mb-0.5">方向</label>
          <RadioGroup
            value={direction}
            onChange={setDirection}
            options={[
              { value: 0, label: '前进' },
              { value: 1, label: '后退' },
            ]}
          />
        </div>
        <div>
          <label className="text-sm text-text-secondary block mb-0.5">台阶高度</label>
          <RadioGroup
            value={stepHeight}
            onChange={setStepHeight}
            options={[
              { value: 0, label: '200mm' },
              { value: 1, label: '400mm' },
            ]}
          />
        </div>
        <div>
          <label className="text-sm text-text-secondary block mb-0.5">动作结束后底盘高度</label>
          <RadioGroup
            value={finalHeight}
            onChange={setFinalHeight}
            options={[
              { value: 0, label: 'Low (0.22m)' },
              { value: 1, label: 'High (0.42m)' },
            ]}
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-text-secondary block mb-0.5">台阶作业点 (世界系)</label>
        <div className="grid grid-cols-3 gap-1.5">
          <NumField label="X (m)" step={0.01} value={stepTargetX} onChange={setStepTargetX} />
          <NumField label="Y (m)" step={0.01} value={stepTargetY} onChange={setStepTargetY} />
          <NumField label="Yaw (°)" step={0.1} value={stepTargetYaw} onChange={setStepTargetYaw} />
        </div>
      </div>

      <div>
        <label className="text-sm text-text-secondary block mb-0.5">结束位置 (世界系)</label>
        <div className="grid grid-cols-3 gap-1.5">
          <NumField label="X (m)" step={0.01} value={endX} onChange={setEndX} />
          <NumField label="Y (m)" step={0.01} value={endY} onChange={setEndY} />
          <NumField label="Yaw (°)" step={0.1} value={endYaw} onChange={setEndYaw} />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSend}
        className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover w-full"
      >
        发送 StepPose
      </button>
    </div>
  );
}

type TakeSpearMode = 'byId' | 'byPos';

export function GripControl() {
  const { send } = useCommand();
  const [mode, setMode] = useState<TakeSpearMode>('byId');

  const [spearId, setSpearId] = useState(0);
  const [targetX, setTargetX] = useState(0);
  const [targetY, setTargetY] = useState(0);
  const [targetYaw, setTargetYaw] = useState(0);
  const [endX, setEndX] = useState(0);
  const [endY, setEndY] = useState(0);
  const [endYaw, setEndYaw] = useState(0);

  // GripPose state
  const [armPos, setArmPos] = useState(0);
  const [turnPos, setTurnPos] = useState(0);
  const [clawMode, setClawMode] = useState(0);

  // GripPresetPose state
  const [presetId, setPresetId] = useState(0);

  const handleTake = async () => {
    if (mode === 'byId') {
      await send({
        type: 'TakeSpearById',
        spear_id: spearId,
        end_x: endX,
        end_y: endY,
        end_yaw: endYaw,
      });
    } else {
      await send({
        type: 'TakeSpear',
        target_x: targetX,
        target_y: targetY,
        target_yaw: targetYaw,
        end_x: endX,
        end_y: endY,
        end_yaw: endYaw,
      });
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text">夹爪控制</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* 左列：取矛操作 */}
        <div className="space-y-3">
          <div>
            <label className="text-sm text-text-secondary block mb-0.5">取矛协议</label>
            <RadioGroup
              value={mode}
              onChange={(v) => setMode(v)}
              options={[
                { value: 'byId', label: '按编号 (0x41)' },
                { value: 'byPos', label: '按坐标 (0x40)' },
              ]}
            />
          </div>

          {mode === 'byId' ? (
            <div>
              <label className="text-sm text-text-secondary block mb-0.5">矛编号</label>
              <RadioGroup
                value={spearId}
                onChange={setSpearId}
                options={[0, 1, 2, 3, 4, 5].map((id) => ({ value: id, label: String(id) }))}
              />
            </div>
          ) : (
            <div>
              <label className="text-sm text-text-secondary block mb-0.5">目标位姿</label>
              <div className="grid grid-cols-3 gap-1.5">
                <NumField label="X (m)" step={0.01} value={targetX} onChange={setTargetX} />
                <NumField label="Y (m)" step={0.01} value={targetY} onChange={setTargetY} />
                <NumField label="Yaw (°)" step={0.1} value={targetYaw} onChange={setTargetYaw} />
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-text-secondary block mb-0.5">终点位姿</label>
            <div className="grid grid-cols-3 gap-1.5">
              <NumField label="X (m)" step={0.01} value={endX} onChange={setEndX} />
              <NumField label="Y (m)" step={0.01} value={endY} onChange={setEndY} />
              <NumField label="Yaw (°)" step={0.1} value={endYaw} onChange={setEndYaw} />
            </div>
          </div>

          <button
            onClick={handleTake}
            className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover w-full"
          >
            取矛
          </button>

          <div className="border-t border-border pt-2 grid grid-cols-2 gap-1.5">
            <button
              onClick={() => send({ type: 'StoreKFS' })}
              className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover"
            >
              存储 KFS
            </button>
            <button
              onClick={() => send({ type: 'ReleaseKFS' })}
              className="bg-gray-500 text-white px-3 py-1.5 rounded hover:bg-gray-600"
            >
              释放 KFS
            </button>
          </div>
        </div>

        {/* 右列：夹爪执行器 */}
        <div className="space-y-3">
          {/* SetGripSuction (0x44) */}
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold text-text">Grip 吸盘 (0x44)</h4>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => send({ type: 'SetGripSuction', on: 1 })}
                className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover"
              >
                启动
              </button>
              <button
                onClick={() => send({ type: 'SetGripSuction', on: 0 })}
                className="bg-gray-500 text-white px-3 py-1.5 rounded hover:bg-gray-600"
              >
                关闭
              </button>
            </div>
          </div>

          {/* SetGripClaw (0x46) - 独立夹爪 */}
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold text-text">独立夹爪 (0x46)</h4>
            <p className="text-xs text-text-secondary">仅控制夹爪 GPIO，不影响 arm/turn 关节</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => send({ type: 'SetGripClaw', claw_mode: 0 })}
                className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover"
              >
                张开
              </button>
              <button
                onClick={() => send({ type: 'SetGripClaw', claw_mode: 1 })}
                className="bg-gray-500 text-white px-3 py-1.5 rounded hover:bg-gray-600"
              >
                闭合
              </button>
            </div>
          </div>

          {/* SetGripPose (0x16) */}
          <div className="border-t border-border pt-2 space-y-2">
            <h4 className="text-sm font-semibold text-text">Grip 关节姿态 (0x16)</h4>
            <InputRow label="大臂角 arm_pos (°)" value={armPos} onChange={setArmPos} step={0.1} />
            <InputRow label="转向角 turn_pos (°)" value={turnPos} onChange={setTurnPos} step={0.1} />
            <div>
              <label className="text-sm text-text-secondary block mb-0.5">夹爪模式</label>
              <RadioGroup
                value={clawMode}
                onChange={setClawMode}
                options={[
                  { value: 0, label: '保持' },
                  { value: 1, label: '张开' },
                  { value: 2, label: '闭合' },
                ]}
              />
            </div>
            <button
              onClick={() => send({ type: 'SetGripPose', arm_pos: armPos, turn_pos: turnPos, claw_mode: clawMode })}
              className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover w-full"
            >
              发送关节姿态
            </button>
          </div>

          {/* SetGripPresetPose (0x17) */}
          <div className="border-t border-border pt-2 space-y-2">
            <h4 className="text-sm font-semibold text-text">Grip 预设姿态 (0x17)</h4>
            <div>
              <label className="text-sm text-text-secondary block mb-0.5">预设</label>
              <div className="flex flex-wrap gap-0.5">
                {[
                  { id: 0, label: 'Standby' },
                  { id: 1, label: 'PrepareGrab' },
                  { id: 2, label: 'Grab' },
                  { id: 3, label: 'Docking' },
                  { id: 4, label: 'KfsPickup' },
                  { id: 5, label: 'KfsStore' },
                  { id: 6, label: 'KfsRelease' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPresetId(p.id)}
                    className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${
                      presetId === p.id
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface text-text border-border hover:bg-bg'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => send({ type: 'SetGripPresetPose', preset_id: presetId })}
              className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover w-full"
            >
              发送预设 ({presetId})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SystemControl() {
  const { send } = useCommand();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text">系统控制</h3>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => send({ type: 'Ping' })}
          className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover"
        >
          Ping
        </button>
        <button
          onClick={() => send({ type: 'StopChassis' })}
          className="bg-danger text-white px-3 py-1.5 rounded hover:opacity-90"
        >
          紧急停止
        </button>
      </div>

      {/* SetAbdomenSuction (0x45) */}
      <div className="border-t border-border pt-2 space-y-1.5">
        <h4 className="text-sm font-semibold text-text">腹部吸盘 (0x45)</h4>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => send({ type: 'SetAbdomenSuction', on: 1 })}
            className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover"
          >
            启动
          </button>
          <button
            onClick={() => send({ type: 'SetAbdomenSuction', on: 0 })}
            className="bg-gray-500 text-white px-3 py-1.5 rounded hover:bg-gray-600"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

interface PostureControlProps {
  state: RobotState | null;
}

const POSTURE_XY_VMAX_DEFAULT = 3.0;
const POSTURE_XY_AMAX_DEFAULT = 3.0;
const POSTURE_YAW_VMAX_DEFAULT = 180;
const POSTURE_YAW_AMAX_DEFAULT = 180;

export function PostureControl({ state }: PostureControlProps) {
  const { send } = useCommand();
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [yaw, setYaw] = useState(0);
  const [xyVmax, setXyVmax] = useState(POSTURE_XY_VMAX_DEFAULT);
  const [xyAmax, setXyAmax] = useState(POSTURE_XY_AMAX_DEFAULT);
  const [yawVmax, setYawVmax] = useState(POSTURE_YAW_VMAX_DEFAULT);
  const [yawAmax, setYawAmax] = useState(POSTURE_YAW_AMAX_DEFAULT);

  const handleUseCurrent = () => {
    if (state) {
      setX(state.x);
      setY(state.y);
      setYaw(state.yaw);
    }
  };

  const handleSend = async () => {
    try {
      await send({
        type: 'SetMasterChassisTargetCurrentState',
        x,
        y,
        yaw,
        xy_vmax: xyVmax,
        xy_amax: xyAmax,
        yaw_vmax: yawVmax,
        yaw_amax: yawAmax,
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text">位姿控制 (SetMasterChassisTargetCurrentState)</h3>

      <div>
        <div className="flex items-center justify-between mb-0.5">
          <label className="text-sm text-text-secondary">目标位姿</label>
          <button
            type="button"
            onClick={handleUseCurrent}
            disabled={!state}
            className="text-xs px-2 py-0.5 rounded border border-border bg-surface text-text-secondary hover:text-text hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            使用当前位置
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <NumField label="X (m)" step={0.01} value={x} onChange={setX} />
          <NumField label="Y (m)" step={0.01} value={y} onChange={setY} />
          <NumField label="Yaw (°)" step={0.1} value={yaw} onChange={setYaw} />
        </div>
      </div>

      <div>
        <label className="text-sm text-text-secondary block mb-0.5">运动参数</label>
        <div className="grid grid-cols-2 gap-2">
          <SliderRow
            label="XY 最大速度"
            unit="m/s"
            value={xyVmax}
            onChange={setXyVmax}
            min={0}
            max={8}
            step={0.1}
          />
          <SliderRow
            label="XY 最大加速度"
            unit="m/s²"
            value={xyAmax}
            onChange={setXyAmax}
            min={0}
            max={3}
            step={0.05}
          />
          <SliderRow
            label="Yaw 最大速度"
            unit="°/s"
            value={yawVmax}
            onChange={setYawVmax}
            min={0}
            max={460}
            step={1}
          />
          <SliderRow
            label="Yaw 最大加速度"
            unit="°/s²"
            value={yawAmax}
            onChange={setYawAmax}
            min={0}
            max={170}
            step={1}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSend}
        className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover w-full"
      >
        发送位姿指令
      </button>
    </div>
  );
}

interface InputRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
}

function InputRow({ label, value, onChange, step }: InputRowProps) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="flex-1 text-sm text-text-secondary">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="border border-border rounded px-2 py-1 w-28 bg-surface text-text"
      />
    </div>
  );
}

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
}

function NumField({ label, value, onChange, step }: NumFieldProps) {
  return (
    <div>
      <label className="text-xs text-text-secondary block mb-0.5">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full border border-border rounded px-2 py-1 bg-surface text-text"
      />
    </div>
  );
}

interface SliderRowProps {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}

function SliderRow({ label, unit, value, onChange, min, max, step }: SliderRowProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <label className="text-sm text-text-secondary">
          {label} ({unit})
        </label>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(parseFloat(e.target.value) || 0))}
          className="w-20 border border-border rounded px-2 py-0.5 text-sm bg-surface text-text text-right"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

interface RadioGroupProps<T extends string | number> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}

function RadioGroup<T extends string | number>({ value, onChange, options }: RadioGroupProps<T>) {
  return (
    <div className="inline-flex flex-wrap rounded border border-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2 py-0.5 text-sm transition-colors border-r border-border last:border-r-0 ${
            value === opt.value
              ? 'bg-primary text-white'
              : 'bg-surface text-text hover:bg-bg'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
