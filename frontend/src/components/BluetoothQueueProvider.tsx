'use client';

import * as React from 'react';

export const BluetoothQueueContext = React.createContext<{
  queue: Array<() => Promise<void>>;
  enqueue: <T,>(operation: () => Promise<T>) => Promise<T>;
}>({
  queue: [],
  enqueue: (op) => op(),
});

export default function BluetoothQueueProvider({ children }: { children: React.ReactNode }) {
  const queueRef = React.useRef<(() => Promise<void>)[]>([]);
  const queue = queueRef.current;
  const processingRef = React.useRef(false);

  const processQueue = React.useCallback(async () => {
    if (processingRef.current) return;

    processingRef.current = true;
    while (queue.length > 0) {
      const curOperation = queue.shift();
      if (curOperation == null) break;

      try {
        await curOperation();
      } catch (error) {
        console.error('Bluetooth operation failed:', error);
      }
    }
    processingRef.current = false;
  }, [queue]);

  const enqueue = React.useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const wrappedOperation = async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      queue.push(wrappedOperation);
      processQueue();
    });
  }, [processQueue, queue]);

  return (
    <BluetoothQueueContext.Provider value={{ queue, enqueue }}>
      {children}
    </BluetoothQueueContext.Provider>
  );
}