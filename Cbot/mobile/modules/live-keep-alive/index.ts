import { requireNativeModule } from 'expo';

export type LiveKeepAliveOptions = {
  title?: string;
  body?: string;
  endUrl?: string;
  authorization?: string;
  apiKey?: string;
};

type LiveKeepAliveNative = {
  start(title: string, body: string, endUrl: string, authorization: string, apiKey: string): Promise<void>;
  stop(): Promise<void>;
};

function getNative(): LiveKeepAliveNative | null {
  try {
    return requireNativeModule<LiveKeepAliveNative>('LiveKeepAlive');
  } catch {
    return null;
  }
}

export async function startLiveKeepAlive(options: LiveKeepAliveOptions = {}) {
  const native = getNative();
  if (!native) return;
  await native.start(
    options.title || 'CBOT Live',
    options.body || 'Streaming to YouTube',
    options.endUrl || '',
    options.authorization || '',
    options.apiKey || '',
  );
}

export async function stopLiveKeepAlive() {
  const native = getNative();
  if (!native) return;
  await native.stop();
}
