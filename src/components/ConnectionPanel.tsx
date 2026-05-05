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
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-4">Serial Connection</h2>
      <div className="flex gap-2 mb-4">
        <select
          className="border rounded px-3 py-2 flex-1"
          value={selectedPort}
          onChange={(e) => setSelectedPort(e.target.value)}
        >
          <option value="">Select port...</option>
          {ports.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.port_type})
            </option>
          ))}
        </select>
        <button
          onClick={refreshPorts}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Refresh
        </button>
      </div>
      <div className="flex gap-2 items-center">
        {connected ? (
          <button
            onClick={disconnect}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={!selectedPort || connecting}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
        <span className={`ml-2 px-3 py-1 rounded text-sm font-medium ${
          connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
}