/**
 * Traditional Quran Division
 */

export interface QuranDivision {
  id: string;
  nameKey: string; // i18n translation key
  surahNumbers: number[];
  defaultExpanded: boolean;
}

export const QURAN_DIVISIONS: QuranDivision[] = [
  {
    id: 'seven_long',
    nameKey: 'seven_long',
    surahNumbers: [2, 3, 4, 5, 6, 7, 10], // Al-Baqarah to Yunus
    defaultExpanded: true, // First section expanded by default
  },
  {
    id: 'hundreds',
    nameKey: 'hundreds',
    surahNumbers: [11, 12, 13, 14, 15, 16, 17, 18], // Hud to Al-Kahf
    defaultExpanded: false,
  },
  {
    id: 'oft_repeated',
    nameKey: 'oft_repeated',
    surahNumbers: [
      19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
      37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
    ], // Maryam to Al-Hujurat
    defaultExpanded: false,
  },
  {
    id: 'detailed',
    nameKey: 'detailed',
    surahNumbers: [
      50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67,
      68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85,
      86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102,
      103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114,
    ], // Qaf to An-Nas
    defaultExpanded: false,
  },
];

/**
 * Special case: Al-Fatihah (Surah 1) stands alone and is not part of any division
 * It should be displayed separately at the top
 */
export const STANDALONE_SURAHS = [1]; // Al-Fatihah
