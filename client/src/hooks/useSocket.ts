import { useEffect } from 'react';
import { socket } from '../api';

export function useSocket<T = unknown>(event: string, callback: (data: T) => void) {
  useEffect(() => {
    socket.on(event, callback);
    return () => {
      socket.off(event, callback);
    };
  }, [event, callback]);
}
