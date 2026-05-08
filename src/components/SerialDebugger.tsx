import { useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

type Direction = 'tx' | 'rx';

interface LogEntry {
  id: number;
  time: string;
  direction: Direction;
  bytes: number[];
}

const MAX_ENTRIES = 200;
const CONTROL_FRAME_LEN = 21;
const FEEDBACK_FRAME_LEN = 22;

// CRC16 table matching the MCU's C++ implementation:
// RefIn byte, process MSB-first with poly=0x8005, RefOut result.
// Lookup: crc = table[((crc >> 8) ^ byte) & 0xFF] ^ (crc << 8)
const CRC16_TABLE: number[] = [
  0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
  0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
  0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
  0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
  0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
  0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
  0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
  0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
  0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
  0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
  0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
  0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
  0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
  0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
  0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
  0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
  0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
  0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
  0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
  0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
  0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
  0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
  0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
  0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
  0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
  0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
  0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
  0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
  0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
  0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
  0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
  0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040,
];

function crc16modbus(data: number[]): number {
  let crc = 0xFFFF;
  for (const byte of data) {
    const idx = ((crc >> 8) ^ byte) & 0xFF;
    crc = CRC16_TABLE[idx] ^ ((crc << 8) & 0xFFFF);
    crc &= 0xFFFF;
  }
  return crc;
}

function bigEndianU16(bytes: number[], offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function bigEndianU32(bytes: number[], offset: number): number {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function bigEndianI16(bytes: number[], offset: number): number {
  const u = bigEndianU16(bytes, offset);
  return u > 0x7fff ? u - 0x10000 : u;
}

const CMD_NAMES: Record<number, string> = {
  0x01: 'Ping',
  0x10: 'StopChassis',
  0x11: 'SetChassisHeight',
  0x13: 'SetMasterChassisTargetCurrentState',
  0x14: 'SetMasterChassisTargetPreviousCurve',
  0x15: 'SetMasterChassisVelocity',
  0x21: 'LidarPosture',
  0x30: 'StepUp',
  0x31: 'StepUpResume',
  0x32: 'StepDown',
  0x40: 'TakeSpear',
  0x41: 'TakeSpearById',
  0x42: 'StoreKFS',
  0x43: 'ReleaseKFS',
};

interface FieldSegment {
  label: string;
  start: number;
  end: number;
  bgClass: string;
  textClass: string;
  decoded?: string;
}

interface FrameAnalysis {
  valid: boolean;
  errorMsg?: string;
  frameType?: 'control' | 'feedback';
  fields: FieldSegment[];
}

function analyzeFrame(bytes: number[]): FrameAnalysis {
  const len = bytes.length;

  if (len === CONTROL_FRAME_LEN) {
    if (bytes[0] !== 0xaa || bytes[1] !== 0xbb) {
      return { valid: false, errorMsg: '帧头错误(期望AA BB)', fields: [] };
    }
    const crcData = bytes.slice(2, 19);
    const expectedCrc = bigEndianU16(bytes, 19);
    const actualCrc = crc16modbus(crcData);
    const crcOk = actualCrc === expectedCrc;
    const cmd = bytes[2];
    const cmdName = CMD_NAMES[cmd];
    const ts = bigEndianU32(bytes, 15);

    const fields: FieldSegment[] = [
      { label: '帧头', start: 0, end: 2, bgClass: 'bg-blue-500/20', textClass: 'text-blue-300' },
      { label: cmdName ? `Cmd ${cmdName}` : `Cmd 0x${cmd.toString(16).toUpperCase().padStart(2, '0')}`, start: 2, end: 3, bgClass: 'bg-amber-500/20', textClass: 'text-amber-300' },
      { label: '数据(12B)', start: 3, end: 15, bgClass: 'bg-gray-500/15', textClass: 'text-gray-300' },
      { label: `TS=${ts}`, start: 15, end: 19, bgClass: 'bg-emerald-500/20', textClass: 'text-emerald-300' },
      {
        label: crcOk ? 'CRC ✓' : `CRC ✗(期望${expectedCrc.toString(16).toUpperCase()})`,
        start: 19, end: 21,
        bgClass: crcOk ? 'bg-purple-500/20' : 'bg-red-500/50',
        textClass: crcOk ? 'text-purple-300' : 'text-red-200',
      },
    ];

    if (!crcOk) {
      return { valid: false, errorMsg: 'CRC校验失败', fields };
    }
    return { valid: true, frameType: 'control', fields };
  }

  if (len === FEEDBACK_FRAME_LEN) {
    if (bytes[0] !== 0xaa || bytes[1] !== 0xbb) {
      return { valid: false, errorMsg: '帧头错误(期望AA BB)', fields: [] };
    }
    const crcData = bytes.slice(2, 20);
    const expectedCrc = bigEndianU16(bytes, 20);
    const actualCrc = crc16modbus(crcData);
    const crcOk = actualCrc === expectedCrc;

    const ts = bigEndianU32(bytes, 2);
    const x = bigEndianI16(bytes, 6) / 2000;
    const y = bigEndianI16(bytes, 8) / 2000;
    const yaw = bigEndianI16(bytes, 10) / 100;
    const fh = bigEndianI16(bytes, 12) / 2000;
    const rh = bigEndianI16(bytes, 14) / 2000;
    const action = bigEndianU16(bytes, 16);
    const conn = bigEndianU16(bytes, 18);

    const fields: FieldSegment[] = [
      { label: '帧头', start: 0, end: 2, bgClass: 'bg-blue-500/20', textClass: 'text-blue-300' },
      { label: `TS=${ts}`, start: 2, end: 6, bgClass: 'bg-emerald-500/20', textClass: 'text-emerald-300' },
      { label: `X=${x.toFixed(3)}`, start: 6, end: 8, bgClass: 'bg-cyan-500/20', textClass: 'text-cyan-300' },
      { label: `Y=${y.toFixed(3)}`, start: 8, end: 10, bgClass: 'bg-sky-500/20', textClass: 'text-sky-300' },
      { label: `Yaw=${yaw.toFixed(1)}°`, start: 10, end: 12, bgClass: 'bg-indigo-500/20', textClass: 'text-indigo-300' },
      { label: `FH=${fh.toFixed(3)}`, start: 12, end: 14, bgClass: 'bg-yellow-500/20', textClass: 'text-yellow-300' },
      { label: `RH=${rh.toFixed(3)}`, start: 14, end: 16, bgClass: 'bg-orange-500/20', textClass: 'text-orange-300' },
      { label: `Act=0x${action.toString(16).toUpperCase().padStart(4, '0')}`, start: 16, end: 18, bgClass: 'bg-rose-500/20', textClass: 'text-rose-300' },
      { label: `Conn=0x${conn.toString(16).toUpperCase().padStart(4, '0')}`, start: 18, end: 20, bgClass: 'bg-fuchsia-500/20', textClass: 'text-fuchsia-300' },
      {
        label: crcOk ? 'CRC ✓' : `CRC ✗`,
        start: 20, end: 22,
        bgClass: crcOk ? 'bg-purple-500/20' : 'bg-red-500/50',
        textClass: crcOk ? 'text-purple-300' : 'text-red-200',
      },
    ];

    if (!crcOk) {
      return { valid: false, errorMsg: 'CRC校验失败', fields };
    }
    return { valid: true, frameType: 'feedback', fields };
  }

  return { valid: false, errorMsg: `长度错误(${len}B, 期望21或22)`, fields: [] };
}

function byteToHex(b: number): string {
  return b.toString(16).padStart(2, '0').toUpperCase();
}

function formatTime(d: Date): string {
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function FrameHexDisplay({ bytes }: { bytes: number[] }) {
  const analysis = analyzeFrame(bytes);
  const typeLabel = analysis.frameType === 'control' ? 'CTL' : analysis.frameType === 'feedback' ? 'FDB' : '???';
  const typeBg = analysis.frameType === 'control' ? 'bg-primary/60' : analysis.frameType === 'feedback' ? 'bg-success/60' : 'bg-gray-500/60';

  if (!analysis.valid) {
    // Parse failure: render entire frame in red
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="shrink-0 text-[10px] px-1 rounded font-bold text-white bg-red-600">{typeLabel}</span>
          <span className="px-1.5 py-0.5 rounded bg-red-500/25 text-red-300 font-mono break-all">
            {bytes.map((b) => byteToHex(b)).join(' ')}
          </span>
        </div>
        <span className="text-[10px] text-red-400 pl-7">{analysis.errorMsg}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-x-1 gap-y-0.5 flex-wrap">
        <span className={`shrink-0 text-[10px] px-1 rounded font-bold text-white ${typeBg}`}>{typeLabel}</span>
        {analysis.fields.map((f, i) => (
          <span
            key={i}
            className={`px-0.5 rounded font-mono text-xs ${f.bgClass} ${f.textClass}`}
            title={f.label}
          >
            {bytes.slice(f.start, f.end).map((b) => byteToHex(b)).join(' ')}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-x-1 gap-y-0.5 flex-wrap pl-7 text-[10px] text-text-secondary">
        {analysis.fields.map((f, i) => (
          <span key={i} className={`${f.textClass} truncate max-w-[10rem]`}>{f.label}</span>
        ))}
      </div>
    </div>
  );
}

export function SerialDebugger() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<'all' | Direction>('all');
  const idCounter = useRef(0);
  const pausedRef = useRef(paused);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rxBufferRef = useRef<number[]>([]);
  const [rxTotalBytes, setRxTotalBytes] = useState(0);
  const [validFdbCount, setValidFdbCount] = useState(0);
  const [validCtlEchoCount, setValidCtlEchoCount] = useState(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Drain frames from the rx buffer.  Valid feedback frames and valid control
  // echoes (serial hardware loopback) are counted but not displayed.  Invalid
  // frames are shown in red.
  const drainRxBuffer = (buffer: number[]) => {
    const invalidFrames: number[][] = [];
    let validFdbCount = 0;
    let validCtlEchoCount = 0;
    let start = 0;
    while (start + 21 <= buffer.length) {
      if (buffer[start] === 0xAA && buffer[start + 1] === 0xBB) {
        if (start + 22 <= buffer.length) {
          const candidate = buffer.slice(start, start + 22);
          const analysis = analyzeFrame(candidate);
          if (analysis.valid && analysis.frameType === 'feedback') {
            validFdbCount++;
            start += 22;
            continue;
          }
          // CRC failed — advance by 1 to find next header (real frames may
          // have been smushed together in one read chunk)
          invalidFrames.push(candidate);
          start += 1;
          continue;
        }
        // Only 21 bytes available — check if it's a valid CTL echo
        const candidate = buffer.slice(start, start + 21);
        const analysis = analyzeFrame(candidate);
        if (analysis.valid && analysis.frameType === 'control') {
          validCtlEchoCount++;
          start += 21;
          continue;
        }
        invalidFrames.push(candidate);
        start += 1;
        continue;
      }
      start += 1;
    }
    return { invalidFrames, validFdbCount, validCtlEchoCount, consumed: start };
  };

  useEffect(() => {
    let unlistenTx: UnlistenFn | null = null;
    let unlistenRx: UnlistenFn | null = null;
    let unlistenCs: UnlistenFn | null = null;
    let cancelled = false;

    const appendTx = (bytes: number[]) => {
      if (pausedRef.current) return;
      const entry: LogEntry = {
        id: idCounter.current++,
        time: formatTime(new Date()),
        direction: 'tx',
        bytes,
      };
      setEntries((prev) => {
        const next = prev.length >= MAX_ENTRIES ? prev.slice(prev.length - MAX_ENTRIES + 1) : prev;
        return [...next, entry];
      });
    };

    const appendRxRaw = (bytes: number[]) => {
      if (pausedRef.current) return;
      setRxTotalBytes((n) => n + bytes.length);
      rxBufferRef.current.push(...bytes);
      const { invalidFrames, validFdbCount: newValid, validCtlEchoCount: newCtl, consumed } = drainRxBuffer(rxBufferRef.current);
      if (consumed > 0) {
        rxBufferRef.current = rxBufferRef.current.slice(consumed);
      }
      // Limit buffer to prevent unbounded growth on garbage data
      if (rxBufferRef.current.length > 512) {
        rxBufferRef.current = rxBufferRef.current.slice(-256);
      }
      if (newValid > 0) {
        setValidFdbCount((n) => n + newValid);
      }
      if (newCtl > 0) {
        setValidCtlEchoCount((n) => n + newCtl);
      }
      if (invalidFrames.length > 0) {
        const now = new Date();
        setEntries((prev) => {
          let next = prev;
          for (const frame of invalidFrames) {
            const entry: LogEntry = {
              id: idCounter.current++,
              time: formatTime(now),
              direction: 'rx',
              bytes: frame,
            };
            if (next.length >= MAX_ENTRIES) {
              next = next.slice(next.length - MAX_ENTRIES + 1);
            }
            next = [...next, entry];
          }
          return next;
        });
      }
    };

    (async () => {
      const tx = await listen<number[]>('serial_tx', (e) => appendTx(e.payload));
      if (cancelled) { tx(); return; }
      unlistenTx = tx;
      const rx = await listen<number[]>('serial_rx', (e) => appendRxRaw(e.payload));
      if (cancelled) { rx(); return; }
      unlistenRx = rx;
      const cs = await listen<string>('connection_status', (e) => {
        if (e.payload === 'disconnected') {
          rxBufferRef.current = [];
          setRxTotalBytes(0);
          setValidFdbCount(0);
          setValidCtlEchoCount(0);
        }
      });
      if (cancelled) { cs(); return; }
      unlistenCs = cs;
    })();

    return () => {
      cancelled = true;
      unlistenTx?.();
      unlistenRx?.();
      unlistenCs?.();
    };
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, autoScroll]);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.direction === filter);

  return (
    <div className="bg-surface rounded-lg shadow border border-border flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold text-text">串口调试</h2>
        <div className="flex gap-1 text-xs">
          <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>全部</FilterBtn>
          <FilterBtn active={filter === 'tx'} onClick={() => setFilter('tx')}>TX</FilterBtn>
          <FilterBtn active={filter === 'rx'} onClick={() => setFilter('rx')}>RX</FilterBtn>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border flex items-center gap-3 flex-wrap text-xs">
        <button
          onClick={() => setPaused((p) => !p)}
          className={`px-2 py-1 rounded text-white transition-colors ${
            paused ? 'bg-warning' : 'bg-gray-500 hover:bg-gray-600'
          }`}
        >
          {paused ? '已暂停' : '暂停'}
        </button>
        <button
          onClick={() => { setEntries([]); setRxTotalBytes(0); setValidFdbCount(0); setValidCtlEchoCount(0); }}
          className="px-2 py-1 rounded bg-gray-500 text-white hover:bg-gray-600"
        >
          清空
        </button>
        <button
          onClick={() => {
            for (let i = 0; i < 50; i++) invoke('ping');
          }}
          className="px-2 py-1 rounded bg-primary text-white hover:bg-primary/80"
        >
          发送 50 Ping
        </button>
        <label className="flex items-center gap-1 text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-primary"
          />
          自动滚动
        </label>
        <span className="ml-auto text-text-secondary font-mono">
          <span className="text-success">FDB {validFdbCount}</span> · <span className="text-primary">CTL {validCtlEchoCount}</span> | 错误帧 {entries.length} | {rxTotalBytes} B
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 font-mono text-xs space-y-1.5 min-h-0"
      >
        {filtered.length === 0 ? (
          <div className="text-center text-text-secondary py-8">无数据</div>
        ) : (
          filtered.map((e) => (
            <div
              key={e.id}
              className="flex gap-2 px-2 py-1.5 rounded hover:bg-bg"
            >
              <span className="text-text-secondary shrink-0 pt-0.5">{e.time}</span>
              <span
                className={`shrink-0 font-bold pt-0.5 ${
                  e.direction === 'tx' ? 'text-primary' : 'text-success'
                }`}
              >
                {e.direction === 'tx' ? '→' : '←'}
              </span>
              <div className="min-w-0 flex-1">
                <FrameHexDisplay bytes={e.bytes} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded transition-colors ${
        active ? 'bg-primary text-white' : 'bg-bg text-text-secondary hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
