import { Text, TextStyle } from 'react-native';
import { getSurahLigature } from '../config/surahName';
import { isArabic } from '../services/i18n';
import { getFontFamily } from '../utils/fonts';

interface SurahNameProps {
  surahNumber: number;
  fallbackName: string;
  style?: TextStyle;
  fontSize?: number;
  numberOfLines?: number;
}

/**
 * SurahName component that displays beautiful calligraphic surah names
 * when in Arabic mode, falls back to text names in other languages.
 *
 * Usage:
 * <SurahName
 *   surahNumber={1}
 *   fallbackName="Al-Fatihah"
 *   fontSize={28}
 *   style={styles.surahName}
 * />
 */
export default function SurahName({
  surahNumber,
  fallbackName,
  style,
  fontSize = 16,
  numberOfLines = 1
}: SurahNameProps) {
  const arabic = isArabic();
  const ligature = getSurahLigature(surahNumber);

  // Use calligraphic ligature font in Arabic mode if available
  if (arabic && ligature) {
    return (
      <Text
        style={[
          {
            fontFamily: 'SurahNames',
            fontSize: fontSize * 1.2, // Slightly larger for visual balance
          },
          style,
        ]}
        numberOfLines={numberOfLines}
      >
        {ligature}
      </Text>
    );
  }

  // Fallback to regular text name
  return (
    <Text
      style={[
        {
          fontFamily: getFontFamily(arabic, 'bold'),
          fontSize,
        },
        style,
      ]}
      numberOfLines={numberOfLines}
    >
      {fallbackName}
    </Text>
  );
}
