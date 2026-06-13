import { useState } from 'react';
import { useSerial } from '../hooks/useSerial';

export function ConnectionPanel() {
  const { connected, ports, connect, disconnect, refreshPorts } = useSerial();
  const [selectedPort, setSelectedPort] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!selectedPort) return;
    setConnecting(true);
    try {
      await connect(selectedPort, 230400);
    } catch (e) {
      console.error(e);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="bg-surface rounded-lg shadow p-3 border border-border">
      <h2 className="text-base font-semibold mb-3 text-text">串口连接</h2>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <select
          className="border border-border rounded px-3 py-1.5 flex-1 min-w-0 bg-surface text-text"
          value={selectedPort}
          onChange={(e) => setSelectedPort(e.target.value)}
        >
          <option value="">选择串口...</option>
          {ports.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.port_type})
            </option>
          ))}
        </select>
        <button
          onClick={refreshPorts}
          className="bg-gray-500 text-white px-3 py-1.5 rounded hover:bg-gray-600"
        >
          刷新
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {connected ? (
          <button
            onClick={disconnect}
            className="bg-danger text-white px-3 py-1.5 rounded hover:bg-danger/80"
          >
            断开
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={!selectedPort || connecting}
            className="bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-hover disabled:opacity-50"
          >
            {connecting ? '连接中...' : '连接'}
          </button>
        )}
        <span className={`ml-1.5 px-2 py-0.5 rounded text-sm font-medium ${
          connected ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
        }`}>
          {connected ? '已连接' : '未连接'}
        </span>
      </div>
    </div>
  );
}