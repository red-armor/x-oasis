import { useState, useEffect, useRef } from 'react';
import { clientHost } from '@x-oasis/async-call-rpc/core';
import { WorkerChannel } from '@x-oasis/async-call-rpc-web/core';

function ComputePanel() {
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [n, setN] = useState(35);
  const computeRef = useRef<any>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url), {
      type: 'module',
    });
    const channel = new WorkerChannel(worker, { name: 'compute' });

    computeRef.current = clientHost
      .registerClient('compute', { channel })
      .createProxy();

    return () => worker.terminate();
  }, []);

  const handleCompute = async () => {
    if (!computeRef.current) return;

    setLoading(true);
    try {
      const fib = await computeRef.current.fibonacci(n);
      setResult(fib);
    } catch (err) {
      console.error('Compute error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <h2>Background Computation (Web Worker)</h2>
      <p>
        Computing Fibonacci numbers in a Web Worker to avoid blocking the UI
      </p>

      <div className="form">
        <label>
          n ={' '}
          <input
            type="number"
            value={n}
            onChange={(e) => setN(parseInt(e.target.value))}
            min="0"
            max="50"
            style={{ width: '60px' }}
          />
        </label>
        <button
          onClick={handleCompute}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Computing...' : 'Compute Fibonacci'}
        </button>
      </div>

      {result !== null && (
        <div className="result">
          <strong>Result:</strong> fibonacci({n}) = {result.toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default ComputePanel;
