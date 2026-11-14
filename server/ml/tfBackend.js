import os from 'os';

let tfInstance = null;
let backendMode = null;

export async function getTF() {
  if (tfInstance) return { tf: tfInstance, backendMode };

  try {
    const tfNode = await import('@tensorflow/tfjs-node');
    tfInstance = tfNode.default || tfNode;
    backendMode = 'tfjs-node (Native C++ / oneDNN CPU)';
    return { tf: tfInstance, backendMode };
  } catch (err) {
    console.warn('Native @tensorflow/tfjs-node unavailable, falling back to pure JS CPU backend:', err.message);
    const tf = await import('@tensorflow/tfjs');
    await import('@tensorflow/tfjs-backend-cpu');
    await tf.setBackend('cpu');
    await tf.ready();
    tfInstance = tf;
    backendMode = 'tfjs-backend-cpu (Pure JavaScript fallback)';
    return { tf: tfInstance, backendMode };
  }
}

export function getRuntimeCapabilities() {
  const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
  const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
  return {
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpuCount: os.cpus().length,
    totalMemoryMb: totalMemMb,
    freeMemoryMb: freeMemMb,
    backendMode: backendMode || 'uninitialized',
    pythonRequired: false,
  };
}
