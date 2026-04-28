import { useCallback } from 'react';

export function useHaptic() {
  const triggerLight = useCallback(() => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, []);

  const triggerMedium = useCallback(() => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(30);
    }
  }, []);

  const triggerSuccess = useCallback(() => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      // Success pattern: two quick vibrations
      navigator.vibrate([20, 30, 20]);
    }
  }, []);

  const triggerError = useCallback(() => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      // Error pattern: longer vibration
      navigator.vibrate(50);
    }
  }, []);

  return { triggerLight, triggerMedium, triggerSuccess, triggerError };
}
