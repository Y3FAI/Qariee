# Qariee React Native Application - React Expert Code Review

**Date**: 2026-01-09
**Reviewer**: Claude (React Expert)
**Scope**: Comprehensive review of React/React Native patterns, performance, component architecture, state management, hooks usage, TypeScript, and best practices

---

## Executive Summary

This review analyzed the Qariee React Native/Expo Quran audio application, focusing specifically on React best practices, performance patterns, component architecture, state management, hook usage, and code quality from a React development perspective.

### Overall Assessment

| Category | Rating | Notes |
|----------|--------|-------|
| **React Best Practices** | Good | Generally follows React patterns with some improvement opportunities |
| **Performance** | Good | Few obvious bottlenecks; some memoization opportunities |
| **Component Architecture** | Good | Reasonable component structure; player.tsx is large but manageable |
| **State Management** | Good | Context API used appropriately; minimal prop drilling |
| **Type Safety** | Good | TypeScript usage is thorough; some `any` types present |
| **Code Organization** | Very Good | Clear file structure and separation of concerns |
| **Hook Usage** | Good | Proper use of hooks with some dependency array issues |

### Key Metrics

| Metric | Value |
|--------|-------|
| Total Files Reviewed | 22 |
| Critical Issues | 0 |
| High Priority Issues | 4 |
| Medium Priority Issues | 6 |
| Low Priority Issues | 6 |
| Positive Findings | 10 |

---

## Critical Issues

### None Found

No critical issues that would cause immediate failures or security vulnerabilities were identified from a React/React Native perspective.

---

## High Priority Issues

### 1. Layout Calculation at Module Scope - Orientation Change Bug

**File**: `/app/app/player.tsx`
**Lines**: 50-126

**Current Issue**:
```typescript
// Layout calculation runs ONCE when module loads
const layout = calculateLayout()
const PHOTO_SIZE = layout.PHOTO_SIZE
const ARTWORK_BOTTOM_MARGIN = layout.ARTWORK_BOTTOM_MARGIN
// ... more constants using module-level layout
```

**Why It's a Problem**:
The `calculateLayout()` function is called once at module load time, not when the component mounts or when dimensions change. If the device orientation changes or the app is restored from multi-window on Android, these calculations will be incorrect.

**Impact**: **Correctness** - Layout will be wrong if orientation changes after app loads.

**Recommended Fix**:
```typescript
import { useWindowDimensions } from 'react-native';

export default function PlayerScreen() {
    const { height, width } = useWindowDimensions();

    const layout = useMemo(() => calculateLayout(height, width), [height, width]);

    const PHOTO_SIZE = layout.PHOTO_SIZE;
    // ...
}
```

**Effort**: Medium - Requires refactoring constants to be computed values

---

### 2. Missing useCallback Dependencies in AudioContext Effects

**File**: `/app/src/contexts/AudioContext.tsx`
**Lines**: 543, 568, 605

**Current Issue**:
```typescript
// Line 543
}, [currentTrack, isPlaying, playedTrackIds, shuffleHistory, playedTracksOrder])
```

**Why It's a Problem**:
Several `useEffect` hooks have extensive dependency arrays that include mutable state objects (`playedTrackIds` is a `Set`, `shuffleHistory` and `playedTracksOrder` are arrays). New references are created frequently, causing these effects to run more often than necessary.

Additionally, the effects that save session data are duplicating logic across three places (lines 513-543, 545-568, 573-605) with slightly different conditions.

**Impact**: **Performance** - These effects may run excessively; duplicate session-saving logic is a maintenance burden.

**Recommended Fix**:
```typescript
// Use refs for values that don't need to trigger re-renders
const playedTrackIdsRef = useRef(playedTrackIds);
useEffect(() => { playedTrackIdsRef.current = playedTrackIds; }, [playedTrackIds]);

// Create a single save function
const saveSession = useCallback(() => {
    if (!currentTrack || !sessionLoadedRef.current) return;
    // ... save logic using refs
}, [currentTrack]);

// Single effect for all session saving
useEffect(() => {
    const interval = setInterval(() => {
        if (isPlaying) saveSession();
    }, 1000);
    return () => clearInterval(interval);
}, [isPlaying, saveSession]);
```

**Effort**: Medium - Requires careful refactoring to maintain existing behavior

---

### 3. Async State Updates in DownloadContext

**File**: `/app/src/contexts/DownloadContext.tsx`
**Lines**: 74-92

**Current Issue**:
```typescript
setActiveDownloads(prev => {
    const updated = new Map(prev);

    if (progress.status === 'completed') {
        updated.delete(key);
        // Async functions called synchronously during state update
        refreshDownloads();
        updateStorageUsed();
    }
    // ...
    return updated;
});
```

**Why It's a Problem**:
Calling async functions (`refreshDownloads()`, `updateStorageUsed()`) during a state update without awaiting them could lead to race conditions. The state update completes before these async operations finish.

**Impact**: **Correctness** - Downloads might not be immediately reflected in the UI; could cause UI inconsistencies.

**Recommended Fix**:
```typescript
if (progress.status === 'completed') {
    updated.delete(key);
    // Return early, then trigger updates
    Promise.all([
        refreshDownloads(),
        updateStorageUsed()
    ]).catch(err => console.error('Error updating downloads:', err));
    return updated;
}
```

**Effort**: Low - Simple reordering of operations

---

### 4. Stale Closure Pattern in AudioContext Needs Documentation

**File**: `/app/src/contexts/AudioContext.tsx`
**Lines**: 108-155

**Current Issue**:
```typescript
const handleTrackFinished = useCallback(() => {
    const current = currentTrackRef.current
    if (!current) return

    // Uses state setters directly
    setPlayedTrackIds(prev => new Set([...prev, `${current.reciterId}:${current.surahNumber}`]))
    setCurrentTrack({ /* ... */ })
}, []) // Empty dependency array!
```

**Why It's a Problem**:
The callback intentionally has no dependencies and uses refs to avoid closure issues. While this pattern works (React state setters are stable), it's non-obvious and fragile. A future developer might add dependencies thinking it's an error.

**Impact**: **Maintainability** - Pattern is not documented; could be "fixed" incorrectly.

**Recommended Fix**:
```typescript
/**
 * Track finish handler with empty dependency array.
 *
 * IMPORTANT: This uses refs instead of direct state values to avoid
 * closure staleness. The empty deps array is intentional - state setters
 * are stable functions and we only need fresh values from refs.
 */
const handleTrackFinished = useCallback(() => {
    // ...
}, []);
```

**Effort**: Low - Just adding documentation

---

## Medium Priority Issues

### 5. Large player.tsx Component - Extract Custom Hooks

**File**: `/app/app/player.tsx`
**Size**: ~876 lines

**Current Issue**:
The player component contains multiple concerns:
- Layout calculations (50 lines)
- Slider state management (100+ lines)
- Track navigation logic (200+ lines)
- UI rendering (400+ lines)

**Impact**: **Maintainability** - Harder to test and modify individual features.

**Recommended Refactoring**:
```typescript
// Extract to custom hooks:
// 1. usePlayerLayout() - responsive layout calculations
// 2. useSliderState(position, duration, seekTo) - slider interaction
// 3. useTrackNavigation(currentTrack, playTrack) - prev/next logic

const { PHOTO_SIZE, CONTAINER_STYLE, ... } = usePlayerLayout();
const { displayPosition, handleSlidingStart, handleSlidingComplete } = useSliderState(position, duration, seekTo);
const { handlePlayNext, handlePlayPrevious, isProcessingTrackChange } = useTrackNavigation(currentTrack, playTrack);
```

**Effort**: Medium - Requires careful extraction and testing

---

### 6. renderSurahItem Function Should Be a Memoized Component

**File**: `/app/app/reciter/[id].tsx`
**Lines**: 276-354

**Current Issue**:
```typescript
const renderSurahItem = (surah: Surah) => {
    if (!reciter) return null;

    const name = getSurahName(surah);
    const isDownloaded = checkDownloaded(reciter.id, surah.number);
    // ... creates new function references on each render
}
```

**Why It's a Problem**:
This is a function (not a component) called within `.map()`. Every render creates new function references and recalculates values.

**Impact**: **Performance** - Each item gets new handlers on every parent render.

**Recommended Fix**:
```typescript
const SurahItem = memo(({ surah, reciter, onPlay, onDownload, isRTL, arabic }: SurahItemProps) => {
    const name = useMemo(() => getSurahName(surah), [surah, isRTL]);
    const isDownloaded = useMemo(() => checkDownloaded(reciter.id, surah.number), [reciter.id, surah.number]);

    return (
        <TouchableOpacity onPress={() => onPlay(surah)}>
            {/* ... */}
        </TouchableOpacity>
    );
});

// Usage:
{sectionSurahs.map(surah => (
    <SurahItem
        key={surah.number}
        surah={surah}
        reciter={reciter}
        onPlay={handlePlaySurah}
        onDownload={handleDownloadSurah}
        isRTL={rtl}
        arabic={arabic}
    />
))}
```

**Effort**: Medium - Requires creating proper types and component

---

### 7. Duplicate hexToRgba Function Across Files

**Files**:
- `/app/app/player.tsx` (lines 178-187)
- `/app/app/reciter/[id].tsx` (lines 43-52)
- `/app/src/components/MiniPlayer.tsx` (lines 50-59)

**Current Issue**:
Identical utility function duplicated in three files.

**Impact**: **Maintainability** - Changes must be made in multiple places; violates DRY principle.

**Recommended Fix**:
```typescript
// app/src/utils/colors.ts
export const hexToRgba = (hex: string | null | undefined, alpha: number): string => {
    if (!hex) return `rgba(40, 40, 40, ${alpha})`;

    const num = parseInt(hex.replace("#", ""), 16);
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
```

**Effort**: Low - Simple extraction

---

### 8. Missing React.memo on Performance-Sensitive Components

**Files**: Multiple component files

**Components to memoize**:
- `CircularProgress` - Used in download indicators, re-renders frequently
- `OfflineIndicator` - Re-renders when network state changes
- `MiniPlayer` - Re-renders on every audio state change
- `SurahName` - Used in lists, could benefit from memoization

**Impact**: **Performance** - Unnecessary re-renders when parent components update.

**Example Fix**:
```typescript
// Before
export default function CircularProgress({ size, progress, strokeWidth, color }: Props) {

// After
export default memo(function CircularProgress({ size, progress, strokeWidth, color }: Props) {
    // ...
});
```

**Effort**: Low - Simple wrapper addition

---

### 9. isArabic() Called Multiple Times Per Render

**Files**: Multiple components

**Current Issue**:
```typescript
const arabic = isArabic();
// Later in render...
const isRTL = isArabic() || I18nManager.isRTL;  // Called again!
```

**Impact**: **Performance** - Minor; unnecessary function calls; could be inconsistent if called in different phases.

**Recommended Fix**:
```typescript
const arabic = isArabic();
const rtl = isRTL();  // Use the imported helper
```

**Effort**: Low - Simple variable reuse

---

### 10. Duplicate Language State in settings.tsx

**File**: `/app/app/settings.tsx`
**Lines**: 13, 25-29

**Current Issue**:
```typescript
const [currentLang, setCurrentLang] = useState<'ar' | 'en'>(getCurrentLanguage());

const handleLanguageChange = async (lang: 'ar' | 'en') => {
    if (lang === currentLang) return;
    setCurrentLang(lang);
    await changeLanguage(lang);  // Updates i18n.language
};
```

**Why It's a Problem**:
Two sources of truth for language preference: `currentLang` state and `i18n.language`. If `i18n` changes elsewhere (not likely but possible), they could get out of sync.

**Impact**: **Maintainability** - Duplicate state increases complexity.

**Recommended Fix**:
```typescript
// Derive directly from i18n
const currentLang = i18n.language as 'ar' | 'en';
```

**Effort**: Low - Remove state, use derived value

---

## Low Priority Issues

### 11. Unused setCurrentTrack Export in AudioContext

**File**: `/app/src/contexts/AudioContext.tsx`
**Lines**: 39, 630

**Issue**: `setCurrentTrack` is exposed in the context value but `currentTrack` is only set internally within `AudioContext`. Either:
1. Remove from public API if not meant to be used externally
2. Document when external setting is appropriate

**Impact**: **API Design** - Unclear API surface.

---

### 12. Missing Explicit Return Types on Functions

**Files**: Multiple

**Issue**: Many functions lack explicit return types, relying on TypeScript inference.

```typescript
// Before
const loadReciters = async () => { ... }

// After
const loadReciters = async (): Promise<void> => { ... }
```

**Impact**: **Type Safety** - Minor reduction in type safety and documentation value.

---

### 13. Inconsistent Back Handler Implementation

**Files**: `/app/app/index.tsx`, `/app/app/settings.tsx`, `/app/app/about.tsx`, `/app/app/player.tsx`

**Issue**: Each screen implements its own `BackHandler.addEventListener` with similar patterns. Some use `router.replace('/')`, others use `router.replace('/reciter/${id}')`.

**Impact**: **Maintainability** - Duplicated navigation logic.

**Recommended Fix**:
```typescript
// app/src/hooks/useBackHandler.ts
export function useBackHandler(handler: () => boolean) {
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', handler);
        return () => backHandler.remove();
    }, [handler]);
}
```

---

### 14. Accessibility Labels Missing

**Files**: Multiple UI components

**Issue**: `TouchableOpacity` and button-like elements lack `accessibilityLabel` props for screen readers.

**Example**:
```typescript
<TouchableOpacity
    onPress={handlePlay}
    accessibilityLabel="Play surah"
    accessibilityRole="button"
    accessibilityHint="Plays the selected surah"
>
```

**Impact**: **Accessibility** - App may not be fully accessible to visually impaired users.

---

### 15. Console.log Statements in Production Code

**Files**: Multiple (e.g., AudioContext line 112)

**Issue**: Various `console.log()` statements remain in production code.

**Impact**: **Performance** - Minor; **Best Practice** - Should use proper logging.

**Recommended Fix**:
```typescript
// app/src/utils/logger.ts
export const log = {
    debug: __DEV__ ? console.log : () => {},
    info: console.info,
    warn: console.warn,
    error: console.error,
};
```

---

### 16. Type Assertion for Gradient Array

**File**: `/app/app/index.tsx`
**Line**: 42

**Issue**:
```typescript
return SUBTLE_GRADIENTS[Math.floor(Math.random() * SUBTLE_GRADIENTS.length)] as unknown as readonly [string, string, string, string];
```

Double type assertion (`as unknown as`) suggests the type definitions don't match reality.

**Impact**: **Type Safety** - Undermines type system.

**Recommended Fix**: Fix the type definition of `SUBTLE_GRADIENTS` to match the actual type.

---

## Positive Findings

### Strengths

1. **Excellent Architecture**: Clean separation between services (`audioService`, `downloadService`, `database`) and UI components.

2. **Proper Provider Hierarchy**: Context providers are nested appropriately:
   ```
   NetworkProvider -> AudioProvider -> SleepTimerProvider -> DownloadProvider
   ```

3. **Offline-First Design**: Well-implemented offline handling with proper fallbacks and user feedback.

4. **Comprehensive RTL Support**: Full right-to-left support for Arabic users throughout the application.

5. **TypeScript Usage**: Good type definitions with proper interfaces for data models in `/app/src/types/index.ts`.

6. **Singleton Pattern**: Services use singleton pattern appropriately for `audioService`, `downloadService`, and `audioStorage`.

7. **Session Persistence**: Proper handling of audio session restoration after app restart with 7-day expiry.

8. **Smart useRef Usage**: AudioContext correctly uses refs to avoid stale closures in callbacks (lines 97-103).

9. **No Prop Drilling**: Context API effectively eliminates prop drilling for global state.

10. **Responsive Design**: The player component includes sophisticated responsive layout calculations.

11. **Good Hook Patterns**: Proper use of `useCallback` for event handlers, `useMemo` for computed values where needed.

12. **Component Documentation**: Many components have clear JSDoc-style comments explaining their purpose.

---

## File-by-File Summary

### `/app/app/_layout.tsx`
- **Status**: Good
- **Issues**: Missing error handling for `sync()` call (line 33)
- **Positive**: Clean provider hierarchy, proper splash screen handling

### `/app/app/index.tsx`
- **Status**: Good
- **Issues**: `renderReciterCard` should be a memoized component
- **Positive**: Good use of `useFocusEffect` for back handler

### `/app/app/player.tsx`
- **Status**: Needs attention
- **Issues**: Layout at module scope (HIGH), large file size
- **Positive**: Excellent responsive layout calculations, good slider UX

### `/app/app/reciter/[id].tsx`
- **Status**: Good with improvements needed
- **Issues**: `renderSurahItem` function pattern, duplicate `hexToRgba`
- **Positive**: Good search functionality, proper section organization

### `/app/app/settings.tsx`
- **Status**: Good
- **Issues**: Duplicate language state
- **Positive**: Simple, focused component

### `/app/app/about.tsx`
- **Status**: Good
- **Issues**: Minor redundancy in RTL check
- **Positive**: Good use of nested component pattern

### `/app/src/contexts/AudioContext.tsx`
- **Status**: Good
- **Issues**: Large dependency arrays, undocumented pattern in `handleTrackFinished`
- **Positive**: Excellent use of refs to avoid stale closures, proper session persistence

### `/app/src/contexts/DownloadContext.tsx`
- **Status**: Good
- **Issues**: Async state updates in progress callback
- **Positive**: Good handling of deleting currently-playing track

### `/app/src/contexts/NetworkContext.tsx`
- **Status**: Very Good
- **Issues**: None significant
- **Positive**: Simple, focused context with clear API

### `/app/src/contexts/SleepTimerContext.tsx`
- **Status**: Very Good
- **Issues**: None significant
- **Positive**: Proper cleanup, good app state handling

### `/app/src/components/MiniPlayer.tsx`
- **Status**: Good
- **Issues**: Should be memoized
- **Positive**: Good RTL support, proper safe area handling

### `/app/src/components/CircularProgress.tsx`
- **Status**: Good
- **Issues**: Should be memoized
- **Positive**: Clean SVG implementation

### `/app/src/components/OfflineIndicator.tsx`
- **Status**: Good
- **Issues**: Should be memoized
- **Positive**: Simple, focused component

### `/app/src/components/SleepTimerModal.tsx`
- **Status**: Very Good
- **Issues**: Timer options could be in constants file
- **Positive**: Excellent haptic feedback, good accessibility

### `/app/src/components/SurahName.tsx`
- **Status**: Excellent
- **Issues**: None
- **Positive**: Good fallback pattern, proper props interface

### `/app/src/components/CustomDrawer.tsx`
- **Status**: Good
- **Issues**: None significant
- **Positive**: Clean menu structure

### `/app/src/services/i18n.ts`
- **Status**: Good
- **Issues**: Non-blocking init could be documented
- **Positive**: Good language detection, proper persistence

### `/app/src/utils/fonts.ts`
- **Status**: Excellent
- **Issues**: None
- **Positive**: Clean utility function with good typing

---

## Performance Optimization Opportunities

### 1. Component Memoization
Apply `React.memo` to: `CircularProgress`, `OfflineIndicator`, `MiniPlayer`, `SurahName`

### 2. Virtualization
Consider using `FlatList` instead of `ScrollView` for the surah list in `reciter/[id].tsx` (114 items).

### 3. Image Caching
```typescript
<Image
    source={{ uri: getReciterPhotoUrl(reciterId) }}
    cache="force-cache"
    // ...
/>
```

### 4. Effect Consolidation
AudioContext has multiple effects for session persistence that could be consolidated.

---

## Security Considerations

### 1. Email Address Exposure
**File**: `/app/app/about.tsx:24`
The email address is hardcoded. Consider obfuscation or a contact form.

### 2. Network URLs
**File**: `/app/src/constants/config.ts`
CDN URLs are hardcoded. Consider environment variables for different environments.

### 3. Input Validation
**File**: `/app/app/reciter/[id].tsx:69`
Search query has no length limit. Add validation.

---

## Testing Recommendations

### Current State
Good test setup exists for services (`database.test.ts`, `syncService.test.ts`).

### Missing Coverage

1. **Context Tests**: No tests for AudioContext, DownloadContext, NetworkContext, SleepTimerContext
2. **Component Tests**: No component-level tests using React Native Testing Library
3. **Integration Tests**: No tests for navigation flows

### Recommended Test Structure
```
app/src/contexts/__tests__/
  - AudioContext.test.tsx
  - DownloadContext.test.tsx
  - SleepTimerContext.test.tsx

app/src/components/__tests__/
  - MiniPlayer.test.tsx
  - SurahName.test.tsx
  - SleepTimerModal.test.tsx
```

---

## Conclusion

The Qariee application demonstrates **solid React/React Native development practices**. The architecture is well-structured with appropriate separation of concerns. The main areas for improvement are:

1. **Performance**: Add memoization for frequently-rendered components, fix layout calculation timing
2. **Maintainability**: Extract duplicated utilities (`hexToRgba`), decompose large components
3. **Correctness**: Fix state update patterns in DownloadContext, document non-obvious patterns
4. **Accessibility**: Add accessibility labels throughout the app

The codebase is in **good shape** and ready for production with these refinements. No critical issues were found that would block a release.

---

**Report Generated**: 2026-01-09
**Reviewed By**: Claude (React Expert Agent)
**Review Type**: React/React Native Best Practices, Performance, Architecture
