// Default CDN URL - can be overridden by settings from db.json
let CDN_BASE_URL = 'https://rabi.y3f.me';

export const getCdnBaseUrl = (): string => {
  return CDN_BASE_URL;
};

export const setCdnBaseUrl = (url: string): void => {
  CDN_BASE_URL = url;
};

export const getAppDatabaseUrl = (): string => {
  return `${CDN_BASE_URL}/metadata/db.json`;
};

export const getReciterPhotoUrl = (reciterId: string): string => {
  return `${CDN_BASE_URL}/images/reciters/${reciterId}.jpg`;
};

export const getAudioUrl = (reciterId: string, surahNumber: number): string => {
  const surahPadded = surahNumber.toString().padStart(3, '0');
  return `${CDN_BASE_URL}/audio/${reciterId}/${surahPadded}.mp3`;
};
