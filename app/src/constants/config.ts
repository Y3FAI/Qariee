// Default CDN URL - can be overridden by settings from db.json
let CDN_BASE_URL = 'https://pub-ab70d7236e61414aabfd72718fa65d27.r2.dev';

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
  // TODO: Use R2 URLs when audio files are uploaded
  // const surahPadded = surahNumber.toString().padStart(3, '0');
  // return `${CDN_BASE_URL}/audio/${reciterId}/${surahPadded}.mp3`;

  // Demo: Using mp3quran.net for testing
  const surahPadded = surahNumber.toString().padStart(3, '0');
  return `https://server13.mp3quran.net/husr/${surahPadded}.mp3`;
};
