import { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { audioService, Track, PlaybackMode } from '../services/audioService';
import { useNetwork } from './NetworkContext';
import { audioStorage } from '../services/audioStorage';

interface CurrentTrack {
  reciterId: string;
  reciterName: string;
  surahName: string;
  surahNumber: number;
  reciterColorPrimary?: string;
  reciterColorSecondary?: string;
}

interface AudioContextType {
  currentTrack: CurrentTrack | null;
  setCurrentTrack: (track: CurrentTrack | null) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  needsUpdate: boolean;
  setNeedsUpdate: (needsUpdate: boolean) => void;
  position: number;
  duration: number;
  playbackMode: PlaybackMode;
  setPlaybackMode: (mode: PlaybackMode | ((prev: PlaybackMode) => PlaybackMode)) => void;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlayPause: () => void;
  seekTo: (seconds: number) => Promise<void>;
  playNext: () => Promise<void>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children, needsUpdateProp = false }: { children: ReactNode; needsUpdateProp?: boolean }) {
  const player = useAudioPlayer();
  const { isOffline } = useNetwork();
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(needsUpdateProp);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackMode, setPlaybackModeState] = useState<PlaybackMode>('sequential');
  const sessionLoadedRef = useRef(false);

  // Initialize audio service with player and configure audio mode
  useEffect(() => {
    console.log('[AudioContext] Initializing audio service with player');
    audioService.initialize(player);

    // Configure audio mode for background playback
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionModeAndroid: 'duckOthers',
      interruptionMode: 'mixWithOthers',
    });

    // Load saved playback mode and listening session
    loadSavedState();

    return () => {
      console.log('[AudioContext] Cleaning up - but NOT releasing player');
      // Don't release the player here - it causes "released" errors
    };
  }, [player]);

  // Load saved state on mount
  const loadSavedState = async () => {
    try {
      // Load playback mode
      const savedMode = await audioStorage.loadPlaybackMode();
      if (savedMode) {
        setPlaybackModeState(savedMode);
        audioService.setPlaybackMode(savedMode);
      }

      // Load listening session
      const savedSession = await audioStorage.loadListeningSession();
      console.log('[AudioContext] Loaded session from storage:', savedSession);

      if (savedSession) {
        // Set track info
        setCurrentTrack({
          reciterId: savedSession.reciterId,
          reciterName: savedSession.reciterName,
          surahName: savedSession.surahName,
          surahNumber: savedSession.surahNumber,
          reciterColorPrimary: savedSession.reciterColorPrimary,
          reciterColorSecondary: savedSession.reciterColorSecondary,
        });
        // Set position and duration immediately for UI
        setPosition(savedSession.position);
        setDuration(savedSession.duration);

        console.log('[AudioContext] Pre-loading audio for instant playback...');
        // Pre-load the audio immediately so clicking play is instant
        preloadSavedSession(savedSession);
      } else {
        console.log('[AudioContext] No saved session found');
      }
    } catch (error) {
      console.error('Error loading saved state:', error);
    }
  };

  // Pre-load saved session audio in background
  const preloadSavedSession = async (savedSession: any) => {
    try {
      const { getAudioUrl } = await import('../constants/config');
      const { getAllSurahs } = await import('../services/database');
      const { isRTL } = await import('../services/i18n');

      const allSurahs = await getAllSurahs();
      const currentSurah = allSurahs.find(s => s.number === savedSession.surahNumber);
      if (!currentSurah) return;

      const rtl = isRTL();
      const track: Track = {
        reciterId: savedSession.reciterId,
        reciterName: savedSession.reciterName,
        surahNumber: savedSession.surahNumber,
        surahName: rtl ? currentSurah.name_ar : currentSurah.name_en,
        reciterColorPrimary: savedSession.reciterColorPrimary || '#282828',
        reciterColorSecondary: savedSession.reciterColorSecondary || '#404040',
        audioUrl: getAudioUrl(savedSession.reciterId, savedSession.surahNumber),
        isDownloaded: false,
      };

      // Build queue
      const queue: Track[] = allSurahs
        .filter(surah => surah.number > savedSession.surahNumber)
        .map(surah => ({
          reciterId: savedSession.reciterId,
          reciterName: savedSession.reciterName,
          surahNumber: surah.number,
          surahName: rtl ? surah.name_ar : surah.name_en,
          reciterColorPrimary: savedSession.reciterColorPrimary || '#282828',
          reciterColorSecondary: savedSession.reciterColorSecondary || '#404040',
          audioUrl: getAudioUrl(savedSession.reciterId, surah.number),
          isDownloaded: false,
        }));

      // Load audio and seek to position (but don't play)
      await audioService.loadTrack(track, queue);
      if (savedSession.position > 0) {
        await audioService.seekTo(savedSession.position);
      }

      // Mark as loaded - audio is ready, just paused
      sessionLoadedRef.current = true;

      console.log('[AudioContext] Audio pre-loaded and ready at position:', savedSession.position);
    } catch (error) {
      console.error('[AudioContext] Error pre-loading session:', error);
    }
  };

  // **CENTRAL STATE SYNC** - Single source of truth
  const syncStateFromService = () => {
    const track = audioService.getCurrentTrack();
    if (track) {
      setCurrentTrack({
        reciterId: track.reciterId,
        reciterName: track.reciterName,
        surahName: track.surahName,
        surahNumber: track.surahNumber,
        reciterColorPrimary: track.reciterColorPrimary,
        reciterColorSecondary: track.reciterColorSecondary,
      });
    }
  };

  // Update offline status in audio service
  useEffect(() => {
    audioService.setOfflineStatus(isOffline);
  }, [isOffline]);

  // Update state from player - player is single source of truth
  useEffect(() => {
    const interval = setInterval(() => {
      if (player) {
        const prevPlaying = isPlaying;
        const newPlaying = player.playing;
        if (prevPlaying !== newPlaying) {
          console.log('▶️ [INTERVAL] isPlaying changing:', prevPlaying, '→', newPlaying);
        }
        setIsPlaying(newPlaying);

        // Only update position/duration from player if session has been loaded
        // This prevents overwriting saved position with 0 before user clicks play
        if (sessionLoadedRef.current) {
          setPosition(player.currentTime);
          setDuration(player.duration || 0);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [player, isPlaying]);

  // Update media controls position every second
  useEffect(() => {
    if (!currentTrack || !isPlaying) return;

    const mediaControlInterval = setInterval(() => {
      audioService.updateMediaControlPosition();
    }, 1000);

    return () => clearInterval(mediaControlInterval);
  }, [currentTrack, isPlaying]);

  // Handle app state changes (pause when app goes to background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background - save state but let audio continue
        // Media controls will handle pause if user presses pause button
        if (currentTrack && sessionLoadedRef.current) {
          audioStorage.saveListeningSession({
            reciterId: currentTrack.reciterId,
            reciterName: currentTrack.reciterName,
            surahName: currentTrack.surahName,
            surahNumber: currentTrack.surahNumber,
            reciterColorPrimary: currentTrack.reciterColorPrimary,
            reciterColorSecondary: currentTrack.reciterColorSecondary,
            position,
            duration,
            timestamp: Date.now(),
          });
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [currentTrack, position, duration]);

  // Note: Track finished detection is handled by audioService.ts playback monitor
  // to ensure it works even when app is backgrounded. We don't duplicate it here.

  const playTrack = async (track: Track, queue: Track[] = []) => {
    try {
      sessionLoadedRef.current = true;

      await audioService.play(track, queue);

      // Sync state after playing
      syncStateFromService();
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  const togglePlayPause = () => {
    console.log('🎵 [TOGGLE] Called - isPlaying:', isPlaying, 'player.playing:', player.playing);

    // Replay finished track
    const isAtEnd = duration > 0 && position > 0 && (duration - position < 1);
    if (isAtEnd && !player.playing && currentTrack) {
      console.log('🎵 [TOGGLE] Replaying from start');
      audioService.seekTo(0);
      audioService.resume();
    } else {
      // Simple toggle - audio is already loaded
      console.log('🎵 [TOGGLE] Toggling play/pause');
      audioService.togglePlayPause();
    }
  };

  const seekTo = async (seconds: number) => {
    await audioService.seekTo(seconds);
  };

  const playNext = async () => {
    try {
      await audioService.playNext();

      // Sync state after playing next
      syncStateFromService();
    } catch (error) {
      console.error('Error playing next track:', error);

      // If error is due to offline, stop playback and show message would be handled by UI
      // For now, just ensure we sync state even on error
      syncStateFromService();
    }
  };

  const setPlaybackMode = (mode: PlaybackMode | ((prev: PlaybackMode) => PlaybackMode)) => {
    // Handle both direct value and function updater
    const newMode = typeof mode === 'function' ? mode(playbackMode) : mode;
    setPlaybackModeState(newMode);
    audioService.setPlaybackMode(newMode);

    // Persist playback mode
    audioStorage.savePlaybackMode(newMode);
  };

  // Save listening session every 1 second ONLY during playback
  useEffect(() => {
    if (!currentTrack || !sessionLoadedRef.current || !isPlaying) {
      return;
    }

    const saveInterval = setInterval(() => {
      if (currentTrack && duration > 0) {
        console.log('[AudioContext] Saving session:', currentTrack.surahName, 'position:', position.toFixed(1));
        audioStorage.saveListeningSession({
          reciterId: currentTrack.reciterId,
          reciterName: currentTrack.reciterName,
          surahName: currentTrack.surahName,
          surahNumber: currentTrack.surahNumber,
          reciterColorPrimary: currentTrack.reciterColorPrimary,
          reciterColorSecondary: currentTrack.reciterColorSecondary,
          position,
          duration,
          timestamp: Date.now(),
        });
      }
    }, 1000); // Save every 1 second while playing

    return () => clearInterval(saveInterval);
  }, [currentTrack, position, duration, isPlaying]);

  // Save once when pausing
  useEffect(() => {
    if (!isPlaying && currentTrack && duration > 0 && sessionLoadedRef.current) {
      console.log('[AudioContext] Paused - saving final position:', position.toFixed(1));
      audioStorage.saveListeningSession({
        reciterId: currentTrack.reciterId,
        reciterName: currentTrack.reciterName,
        surahName: currentTrack.surahName,
        surahNumber: currentTrack.surahNumber,
        reciterColorPrimary: currentTrack.reciterColorPrimary,
        reciterColorSecondary: currentTrack.reciterColorSecondary,
        position,
        duration,
        timestamp: Date.now(),
      });
    }
  }, [isPlaying]);

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        setCurrentTrack,
        isPlaying,
        setIsPlaying,
        needsUpdate,
        setNeedsUpdate,
        position,
        duration,
        playbackMode,
        setPlaybackMode,
        playTrack,
        togglePlayPause,
        seekTo,
        playNext,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
