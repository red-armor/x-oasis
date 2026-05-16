import { useState, useEffect, useRef } from 'react';
import { WorkerChannel } from '@x-oasis/async-call-rpc-web/core';
import { clientHost } from '@x-oasis/async-call-rpc/core';
import './App.css';

type ComputeService = {
  fibonacci(n: number): Promise<number>;
  isPrime(n: number): Promise<boolean>;
  [key: string]: (...args: any[]) => any;
};

function App() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('35');
  const proxyRef = useRef<ComputeService | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });
    const channel = new WorkerChannel(worker, { name: 'main-thread' });

    proxyRef.current = clientHost
      .registerClient('compute', { channel })
      .createProxy<ComputeService>();

    return () => {
      worker.terminate();
    };
  }, []);

  const handleFibonacci = async () => {
    if (!proxyRef.current) return;
    const n = parseInt(inputValue);
    if (isNaN(n) || n < 0) {
      setError('Please enter a non-negative integer');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fib = await proxyRef.current.fibonacci(n);
      setResult(`fibonacci(${n}) = ${fib.toLocaleString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleIsPrime = async () => {
    if (!proxyRef.current) return;
    const n = parseInt(inputValue);
    if (isNaN(n) || n < 0) {
      setError('Please enter a non-negative integer');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const prime = await proxyRef.current.isPrime(n);
      setResult(`${n} is ${prime ? '' : 'not '}a prime number`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Web Worker RPC</h1>
        <p>
          Offload CPU-intensive computations to a Web Worker via WorkerChannel
        </p>
      </header>

      <main>
        <div className="card">
          <h2>Compute Operations</h2>

          <div className="input-group">
            <label htmlFor="n-input">Enter a number:</label>
            <input
              id="n-input"
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              min="0"
              max="50"
              disabled={loading}
            />
          </div>

          <div className="button-group">
            <button
              onClick={handleFibonacci}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Computing...' : 'Fibonacci'}
            </button>
            <button
              onClick={handleIsPrime}
              disabled={loading}
              className="btn btn-secondary"
            >
              {loading ? 'Checking...' : 'Is Prime?'}
            </button>
          </div>

          {error && <div className="error">Error: {error}</div>}

          {result !== null && !loading && (
            <div className="result">
              <h3>Result</h3>
              <p className="result-value">{result}</p>
            </div>
          )}
        </div>

        <div className="card info-card">
          <h3>How it works</h3>
          <ul>
            <li>Main thread stays responsive during computation</li>
            <li>WorkerChannel wraps the Worker for RPC communication</li>
            <li>serviceHost registers handlers in the Worker</li>
            <li>clientHost creates a typed proxy on the main thread</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default App;
