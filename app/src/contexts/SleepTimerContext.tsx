import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { audioService } from '../services/audioService';

interface SleepTimerContextType {
  isActive: boolean;
  remainingSeconds: number;
  setTimer: (minutes: number) => void;
  clearTimer: () => void;
}

const SleepTimerContext = createContext<SleepTimerContextType | undefined>(undefined);

export function SleepTimerProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync with audioService on mount (e.g., after app restart)
  useEffect(() => {
    if (audioService.isSleepTimerActive()) {
      setIsActive(true);
      setRemainingSeconds(audioService.getSleepTimerRemaining());
    }
  }, []);

  // UI countdown - polls audioService for remaining time
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        const remaining = audioService.getSleepTimerRemaining();
        setRemainingSeconds(remaining);

        if (remaining <= 0) {
          setIsActive(false);
        }
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [isActive]);

  const setTimer = (minutes: number) => {
    audioService.setSleepTimer(minutes, () => {
      setIsActive(false);
      setRemainingSeconds(0);
    });
    setRemainingSeconds(minutes * 60);
    setIsActive(true);
  };

  const clearTimer = () => {
    audioService.clearSleepTimer();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsActive(false);
    setRemainingSeconds(0);
  };

  return (
    <SleepTimerContext.Provider value={{ isActive, remainingSeconds, setTimer, clearTimer }}>
      {children}
    </SleepTimerContext.Provider>
  );
}

export function useSleepTimer() {
  const context = useContext(SleepTimerContext);
  if (context === undefined) {
    throw new Error('useSleepTimer must be used within a SleepTimerProvider');
  }
  return context;
}
