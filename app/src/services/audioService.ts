/**
 * Audio Service - Thin wrapper around expo-audio
 * All state is managed by AudioContext
 */

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Reciter, Surah, Download } from '../types';
import MediaControl, { PlaybackState, Command } from 'expo-media-control';
import BackgroundTimer from 'react-native-background-timer';

// =============================================================================
// Types
// =============================================================================

export interface Track {
    reciterId: string
    reciterName: string
    surahNumber: number
    surahName: string
    audioUrl: string
    isDownloaded: boolean
    reciterColorPrimary?: string
    reciterColorSecondary?: string
}

export type PlaybackMode = 'sequential' | 'shuffle' | 'repeat'

// =============================================================================
// Constants
// =============================================================================

const DATABASE_NAME = 'database.db';

// =============================================================================
// Audio Service (Player Wrapper)
// =============================================================================

class AudioService {
    private player: ReturnType<typeof import('expo-audio').useAudioPlayer> | null = null
    private playbackStatusSubscription: ReturnType<ReturnType<typeof import('expo-audio').useAudioPlayer>['addListener']> | null = null
    private onPlaybackFinish: (() => void) | null = null
    private mediaControlsEnabled = false
    private currentMetadata: {
        title?: string
        artist?: string
        artwork?: string
        duration?: number
    } = {}

    initialize(player: ReturnType<typeof import('expo-audio').useAudioPlayer>) {
        this.player = player
        this.startStatusListener()
        this.setupMediaControls()
        // Enable BackgroundTimer for sleep timer when screen is off
        BackgroundTimer.start()
    }

    private startStatusListener() {
        if (!this.player) return

        this.playbackStatusSubscription?.remove()
        this.playbackStatusSubscription = this.player.addListener(
            'playbackStatusUpdate',
            (status) => {
                if (status.didJustFinish && this.onPlaybackFinish) {
                    this.onPlaybackFinish()
                }
            }
        )
    }

    private async setupMediaControls() {
        try {
            await MediaControl.enableMediaControls({
                capabilities: [
                    Command.PLAY,
                    Command.PAUSE,
                    Command.NEXT_TRACK,
                    Command.PREVIOUS_TRACK,
                    Command.STOP,
                    Command.SKIP_FORWARD,
                    Command.SKIP_BACKWARD,
                    Command.SEEK,
                ],
                notification: {
                    showWhenClosed: true,
                },
            })

            MediaControl.addListener((event) => {
                console.log('[MediaControl] Event:', event.command)
                switch (event.command) {
                    case Command.PLAY:
                        this.resume()
                        break
                    case Command.PAUSE:
                        this.pause()
                        break
                    case Command.NEXT_TRACK:
                        // This will be handled by AudioContext
                        if (this.onPlaybackFinish) {
                            this.onPlaybackFinish()
                        }
                        break
                    case Command.PREVIOUS_TRACK:
                        // This will be handled by AudioContext
                        break
                    case Command.STOP:
                        this.stop()
                        break
                    case Command.SKIP_FORWARD:
                        this.seekTo(Math.min(this.getCurrentTime() + 15, this.getDuration()))
                        break
                    case Command.SKIP_BACKWARD:
                        this.seekTo(Math.max(this.getCurrentTime() - 15, 0))
                        break
                    case Command.SEEK:
                        if (event.data?.position !== undefined) {
                            this.seekTo(event.data.position)
                        }
                        break
                }
            })

            this.mediaControlsEnabled = true
            console.log('[MediaControl] Enabled')
        } catch (error) {
            console.error('[MediaControl] Failed to enable:', error)
        }
    }

    async updateMediaMetadata(metadata: {
        title?: string
        artist?: string
        artworkUrl?: string
        duration?: number
    }) {
        if (!this.mediaControlsEnabled) return

        try {
            const mediaMetadata = {
                title: metadata.title,
                artist: metadata.artist,
                duration: metadata.duration,
                ...(metadata.artworkUrl && {
                    artwork: { uri: metadata.artworkUrl }
                })
            }
            await MediaControl.updateMetadata(mediaMetadata)
        } catch (error) {
            console.error('[MediaControl] Failed to update metadata:', error)
        }
    }

    async updatePlaybackState(playing: boolean, position?: number) {
        if (!this.mediaControlsEnabled) return

        try {
            await MediaControl.updatePlaybackState(
                playing ? PlaybackState.PLAYING : PlaybackState.PAUSED,
                position ?? this.getCurrentTime(),
                playing ? 1.0 : 0.0
            )
        } catch (error) {
            console.error('[MediaControl] Failed to update state:', error)
        }
    }

    setOnPlaybackFinish(callback: () => void) {
        this.onPlaybackFinish = callback
    }

    async play(audioSource: string) {
        if (!this.player) throw new Error('Player not initialized')

        this.player.replace(audioSource)
        await new Promise(r => setTimeout(r, 100))
        this.player.play()
    }

    pause() {
        this.player?.pause()
    }

    resume() {
        this.player?.play()
    }

    stop() {
        this.player?.pause()
    }

    seekTo(position: number) {
        this.player?.seekTo(position)
    }

    getPlaying() {
        return this.player?.playing ?? false
    }

    getCurrentTime() {
        return this.player?.currentTime ?? 0
    }

    getDuration() {
        return this.player?.duration ?? 0
    }

    getPlayer() {
        return this.player
    }

    // ==========================================================================
    // Sleep Timer Methods
    // ==========================================================================
    private sleepTimerEndTime: number | null = null
    private sleepTimerCallback: (() => void) | null = null

    setSleepTimer(minutes: number, callback: () => void) {
        const endTime = Date.now() + (minutes * 60 * 1000)
        this.sleepTimerEndTime = endTime
        this.sleepTimerCallback = callback

        // Use BackgroundTimer so it works when screen is off
        BackgroundTimer.setTimeout(() => {
            if (this.sleepTimerCallback) {
                this.sleepTimerCallback()
                this.clearSleepTimer()
            }
        }, minutes * 60 * 1000)
    }

    clearSleepTimer() {
        this.sleepTimerEndTime = null
        this.sleepTimerCallback = null
    }

    isSleepTimerActive(): boolean {
        return this.sleepTimerEndTime !== null
    }

    getSleepTimerEndTime(): number | null {
        return this.sleepTimerEndTime
    }

    resetVolume() {
        // Volume control not available in expo-audio, this is a no-op
        // Volume is controlled at system level
    }

    async fadeOut(duration: number) {
        // expo-audio doesn't support programmatic volume control
        // This is implemented by reducing volume over time
        // For now, just pause
        this.pause()
    }
}

// =============================================================================
// Database Service (unchanged)
// =============================================================================

let db: SQLite.SQLiteDatabase | null = null

const getDb = (): SQLite.SQLiteDatabase => {
    if (!db) {
        db = SQLite.openDatabaseSync(DATABASE_NAME);
    }
    return db;
};

const ensureSQLiteDirectoryExists = async (): Promise<void> => {
    const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
    const dirInfo = await FileSystem.getInfoAsync(sqliteDir);

    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
    }
};

const copyBundledDatabase = async (): Promise<boolean> => {
    const dbPath = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
    const fileInfo = await FileSystem.getInfoAsync(dbPath);

    if (fileInfo.exists) {
        return false;
    }

    const asset = Asset.fromModule(require('../../assets/data/database.db'));
    await asset.downloadAsync();

    if (!asset.localUri) {
        throw new Error('Failed to load bundled database');
    }

    await FileSystem.copyAsync({
        from: asset.localUri,
        to: dbPath,
    });

    return true;
};

export const initDatabase = async (): Promise<void> => {
    await ensureSQLiteDirectoryExists();
    await copyBundledDatabase();
};

export const getDataVersion = async (): Promise<string | null> => {
    return getMetadata('data_version');
};

export const setDataVersion = async (version: string): Promise<void> => {
    await setMetadata('data_version', version);
};

export const upsertReciters = async (reciters: Reciter[]): Promise<void> => {
    if (reciters.length === 0) return;

    const database = getDb();

    await database.withTransactionAsync(async () => {
        for (const reciter of reciters) {
            await database.runAsync(
                `INSERT INTO reciters (id, name_en, name_ar, color_primary, color_secondary, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   name_en = excluded.name_en,
                   name_ar = excluded.name_ar,
                   color_primary = excluded.color_primary,
                   color_secondary = excluded.color_secondary,
                   sort_order = excluded.sort_order`,
                [reciter.id, reciter.name_en, reciter.name_ar, reciter.color_primary, reciter.color_secondary, reciter.sort_order]
            );
        }
    });
};

export const upsertSurahs = async (surahs: Surah[]): Promise<void> => {
    if (surahs.length === 0) return;

    const database = getDb();

    await database.withTransactionAsync(async () => {
        for (const surah of surahs) {
            await database.runAsync(
                `INSERT INTO surahs (number, name_ar, name_en)
                 VALUES (?, ?, ?)
                 ON CONFLICT(number) DO UPDATE SET
                   name_ar = excluded.name_ar,
                   name_en = excluded.name_en`,
                [surah.number, surah.name_ar, surah.name_en]
            );
        }
    });
};

export const getAllReciters = async (): Promise<Reciter[]> => {
    const database = getDb();
    return database.getAllAsync<Reciter>('SELECT * FROM reciters ORDER BY sort_order');
};

export const getReciterById = async (id: string): Promise<Reciter | null> => {
    const database = getDb();
    const result = await database.getFirstAsync<Reciter>(
        'SELECT * FROM reciters WHERE id = ?',
        [id]
    );
    return result || null;
};

export const deleteAllReciters = async (): Promise<void> => {
    const database = getDb();
    await database.runAsync('DELETE FROM reciters');
};

export const getAllSurahs = async (): Promise<Surah[]> => {
    const database = getDb();
    return database.getAllAsync<Surah>('SELECT * FROM surahs ORDER BY number');
};

export const getSurahByNumber = async (number: number): Promise<Surah | null> => {
    const database = getDb();
    const result = await database.getFirstAsync<Surah>(
        'SELECT * FROM surahs WHERE number = ?',
        [number]
    );
    return result || null;
};

export const insertDownload = async (download: Omit<Download, 'downloaded_at'>): Promise<void> => {
    const database = getDb();
    await database.runAsync(
        'INSERT OR REPLACE INTO downloads (reciter_id, surah_number, local_file_path) VALUES (?, ?, ?)',
        [download.reciter_id, download.surah_number, download.local_file_path]
    );
};

export const getDownload = async (
    reciterId: string,
    surahNumber: number
): Promise<Download | null> => {
    const database = getDb();
    const result = await database.getFirstAsync<Download>(
        'SELECT * FROM downloads WHERE reciter_id = ? AND surah_number = ?',
        [reciterId, surahNumber]
    );
    return result || null;
};

export const getAllDownloads = async (): Promise<Download[]> => {
    const database = getDb();
    return database.getAllAsync<Download>(
        'SELECT * FROM downloads ORDER BY downloaded_at DESC'
    );
};

export const getDownloadsByReciter = async (reciterId: string): Promise<Download[]> => {
    const database = getDb();
    return database.getAllAsync<Download>(
        'SELECT * FROM downloads WHERE reciter_id = ? ORDER BY surah_number',
        [reciterId]
    );
};

export const deleteDownload = async (
    reciterId: string,
    surahNumber: number
): Promise<void> => {
    const database = getDb();
    await database.runAsync(
        'DELETE FROM downloads WHERE reciter_id = ? AND surah_number = ?',
        [reciterId, surahNumber]
    );
};

export const isDownloaded = async (
    reciterId: string,
    surahNumber: number
): Promise<boolean> => {
    const download = await getDownload(reciterId, surahNumber);
    return download !== null;
};

export const getMetadata = async (key: string): Promise<string | null> => {
    const database = getDb();
    const result = await database.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_metadata WHERE key = ?',
        [key]
    );
    return result?.value || null;
};

export const setMetadata = async (key: string, value: string): Promise<void> => {
    const database = getDb();
    await database.runAsync(
        'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
        [key, value]
    );
};

// =============================================================================
// Singleton
// =============================================================================

export const audioService = new AudioService();
