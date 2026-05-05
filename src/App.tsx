import { Layout } from './components/Layout';
import { useRobotState, useSerial } from './hooks/useSerial';

function App() {
  const { state } = useRobotState();
  useSerial(); // Initialize serial connection monitoring

  return <Layout state={state} />;
}

export default App;