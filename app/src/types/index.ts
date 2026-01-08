export interface Reciter {
  id: string;
  name_en: string;
  name_ar: string;
  color_primary: string;
  color_secondary: string;
  sort_order: number;
}

export interface Surah {
  number: number;
  name_ar: string;
  name_en: string;
}

export interface Download {
  reciter_id: string;
  surah_number: number;
  local_file_path: string;
  downloaded_at: string;
}

export interface AppSettings {
  cdn_base_url: string;
  app_name: string;
  support_email: string;
  app_version: string;
  min_app_version: string;
}

export interface AppDatabase {
  version: string;
  settings: AppSettings;
  reciters: Reciter[];
}

export interface ReciterMetadata {
  reciters: Reciter[];
}

export interface SurahMetadata {
  surahs: Surah[];
}
