import { AsyncLocalStorage } from "async_hooks";

const heavyWorkContext = new AsyncLocalStorage<boolean>();
let queueTail: Promise<void> = Promise.resolve();

const toMb = (bytes: number) => Number((bytes / 1024 / 1024).toFixed(1));

export function logMemory(label: string, meta: Record<string, unknown> = {}) {
  const usage = process.memoryUsage();
  console.info("[memory]", {
    label,
    rssMb: toMb(usage.rss),
    heapUsedMb: toMb(usage.heapUsed),
    heapTotalMb: toMb(usage.heapTotal),
    externalMb: toMb(usage.external),
    arrayBuffersMb: toMb(usage.arrayBuffers),
    ...meta,
  });
}

export async function withHeavyWork<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (heavyWorkContext.getStore()) {
    return fn();
  }

  let releaseCurrent!: () => void;
  const currentTurn = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const previousTurn = queueTail.catch(() => {});
  queueTail = previousTurn.then(() => currentTurn);

  await previousTurn;

  return heavyWorkContext.run(true, async () => {
    logMemory(`${label}: start`);
    try {
      return await fn();
    } finally {
      logMemory(`${label}: end`);
      releaseCurrent();
    }
  });
}
