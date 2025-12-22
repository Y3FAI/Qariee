import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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
  const endTimeRef = useRef<number | null>(null);
  const fadeStartedRef = useRef<boolean>(false);


  const handleTimerExpired = async () => {
    // Fade out if not already fading
    if (!fadeStartedRef.current) {
      fadeStartedRef.current = true;
      await audioService.fadeOut(10000); // Fade over 10 seconds
    }

    audioService.pause();
    audioService.resetVolume(); // Reset volume for next playback
    setIsActive(false);
    setRemainingSeconds(0);
    endTimeRef.current = null;
    fadeStartedRef.current = false;
  };

  // Monitor app state to check timer when coming back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isActive && endTimeRef.current) {
        // App came to foreground - check if timer has expired
        const now = Date.now();
        if (now >= endTimeRef.current) {
          handleTimerExpired();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isActive]);

  // Sync timer state from audioService on mount (e.g., after app restart)
  useEffect(() => {
    const syncTimerState = async () => {
      if (audioService.isSleepTimerActive()) {
        const endTime = audioService.getSleepTimerEndTime();
        if (endTime) {
          const now = Date.now();
          if (now >= endTime) {
            // Timer already expired - clear it
            audioService.clearSleepTimer();
          } else {
            // Timer still active - sync UI state
            const remainingMs = endTime - now;
            endTimeRef.current = endTime;
            setRemainingSeconds(Math.floor(remainingMs / 1000));
            setIsActive(true);
          }
        }
      }
    };
    syncTimerState();
  }, []);

  // UI countdown - updates every second for display only (timer logic is in audioService)
  useEffect(() => {
    if (isActive && endTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const timeLeft = Math.max(0, Math.floor((endTimeRef.current! - now) / 1000));
        setRemainingSeconds(timeLeft);

        // Check if timer expired (for UI sync only - audioService handles the actual pause)
        if (timeLeft <= 0) {
          setIsActive(false);
          endTimeRef.current = null;
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

  const setTimer = async (minutes: number) => {
    const seconds = minutes * 60;
    const endTime = Date.now() + (seconds * 1000);


    // Reset fade flag and volume
    fadeStartedRef.current = false;
    audioService.resetVolume();

    // Set timer in audio service (works even when screen is off)
    audioService.setSleepTimer(minutes, () => {
      // Callback when timer completes
      setIsActive(false);
      setRemainingSeconds(0);
      endTimeRef.current = null;
      fadeStartedRef.current = false;
    });

    endTimeRef.current = endTime;
    setRemainingSeconds(seconds);
    setIsActive(true);
  };

  const clearTimer = async () => {
    // Clear timer in audio service
    audioService.clearSleepTimer();


    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Reset fade flag and volume
    fadeStartedRef.current = false;
    audioService.resetVolume();

    setIsActive(false);
    setRemainingSeconds(0);
    endTimeRef.current = null;
  };

  return (
    <SleepTimerContext.Provider
      value={{
        isActive,
        remainingSeconds,
        setTimer,
        clearTimer,
      }}
    >
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
