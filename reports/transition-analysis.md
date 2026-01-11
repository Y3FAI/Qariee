# Page Transition Analysis Report

**Date:** 2026-01-11
**App:** Qariee - React Native/Expo
**Focus:** Full Player Screen Transitions (Shaking & Sliding Issues)

---

## Executive Summary

The player screen exhibits visual glitches during navigation—specifically **shaking/stuttering** and **sliding from bottom** effects. This report identifies the root causes across SafeAreaView configuration mismatches, StatusBar animation timing issues, static layout calculations, and missing custom transition configurations.

---

## 1. Navigation Structure Overview

### Stack Configuration (`_layout.tsx:61-71`)

```tsx
<Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="player" />
    <Stack.Screen name="reciter/[id]" />
    <Stack.Screen name="settings" />
    <Stack.Screen name="about" />
</Stack>
```

**Critical Finding:** No custom animation configurations are defined. The app uses expo-router's default platform-specific transitions, which can cause inconsistent behavior.

---

## 2. SafeAreaView Edge Configuration Comparison

| Screen | File | Line | `edges` Config | Wrapper Structure |
|--------|------|------|----------------|-------------------|
| **Home** | `index.tsx` | - | None (no SafeAreaView) | `LinearGradient > View` |
| **Player** | `player.tsx` | 393 | `["top", "bottom"]` | `LinearGradient > SafeAreaView` |
| **Reciter** | `reciter/[id].tsx` | 411 | `[]` (empty) | `SafeAreaView > ScrollView` |
| **Settings** | `settings.tsx` | 33 | `['top']` | `SafeAreaView` |
| **About** | `about.tsx` | 29 | `['top']` | `SafeAreaView` |

### Primary Issue: Edge Mismatch Between Screens

**Reciter → Player Transition Problem:**
```
FROM: reciter/[id].tsx - edges=[] (NO insets applied)
TO:   player.tsx       - edges=["top", "bottom"] (BOTH insets applied)
```

When navigating from reciter to player:
1. Reciter screen has `edges=[]` — no safe area insets are applied
2. Player screen has `edges=["top", "bottom"]` — both top and bottom insets suddenly apply
3. This causes the content to shift vertically by `insets.bottom` pixels
4. Combined with the status bar color change, this creates the "shaking" effect

**Home → Player Transition Problem:**
```
FROM: index.tsx - No SafeAreaView wrapper at all
TO:   player.tsx - edges=["top", "bottom"]
```

---

## 3. StatusBar Animation Race Condition

### Theme Context Flow

```
player.tsx useEffect (line 213-220)
    ↓
setColors({ statusBar: reciterColorSecondary })
    ↓
ThemeContext state update
    ↓
_layout.tsx re-renders
    ↓
StatusBar component updates (animated=true, ~300ms)
```

### The Race Condition

**`_layout.tsx:53-57`:**
```tsx
<StatusBar
    style={getStatusBarStyle(colors.statusBar)}
    backgroundColor={colors.statusBar}
    animated={true}  // Animates over ~300ms
/>
```

**`player.tsx:213-220`:**
```tsx
useEffect(() => {
    if (currentTrack) {
        setColors({
            statusBar: currentTrack.reciterColorSecondary || '#121212',
            background: '#121212',
        })
    }
}, [currentTrack, setColors])
```

**Problem:**
- StatusBar color animates smoothly over ~300ms
- SafeAreaView layout changes happen **instantly**
- ThemeContext update triggers a re-render cascade
- Multiple paint cycles are visible to the user as "stuttering"

---

## 4. Static Layout Calculations

### Player Screen (`player.tsx:53-129`)

Layout dimensions are calculated **once at module load time**:

```tsx
const calculateLayout = () => {
    // Uses Dimensions.get("window") at module initialization
    const AVAILABLE_VERTICAL_SPACE = height - FIXED_ELEMENTS_HEIGHT
    // ... calculations
}

const layout = calculateLayout()  // Line 129 - runs ONCE
```

**Issues:**
1. Dimensions are static for the entire component lifetime
2. Does not respond to SafeAreaView inset changes during navigation
3. No recalculation on orientation changes
4. `TOP_BUTTON_POSITION` is fixed (40 or 50px) regardless of actual safe area

### Reciter Screen (`reciter/[id].tsx:38-40`)

```tsx
const PHOTO_SIZE = 200
const isLargeScreen = height > 800
const TOP_BUTTON_POSITION = isLargeScreen ? 50 : 40
```

Same static dimension problem at module level.

---

## 5. Absolute Positioning Conflicts

### Player Back Button (`player.tsx:663-675`)

```tsx
backButton: {
    position: "absolute",
    top: TOP_BUTTON_POSITION,  // Fixed: 40 or 50
    left: 20,
    zIndex: 10,
    // ...
}
```

**Problem:**
- Position is calculated relative to the screen, not the SafeAreaView
- When SafeAreaView insets change, the button doesn't recalculate
- Creates visual misalignment during transition

### ContentContainer Centering (`player.tsx:649-653`)

```tsx
contentContainer: {
    flex: 1,
    justifyContent: "center",
    paddingTop: CONTENT_TOP_PADDING,  // Static value
}
```

When SafeAreaView applies new insets, the centering recalculates, causing vertical content shift.

---

## 6. MiniPlayer Bottom Margin Dynamics

### `MiniPlayer.tsx:68, 78`

```tsx
const bottomMargin = Math.max(insets.bottom, MIN_BOTTOM_SAFE_AREA)

// Applied in style:
style={[styles.gradientContainer, { marginBottom: bottomMargin }]}
```

**Transition Issue:**
1. MiniPlayer exists on home/reciter screens with calculated `bottomMargin`
2. When player screen opens, MiniPlayer is not rendered
3. The space it occupied (including bottom margin) suddenly disappears
4. Combined with SafeAreaView changes, this contributes to the "sliding" perception

---

## 7. LinearGradient + SafeAreaView Layering

### Player Screen Structure (`player.tsx:382-393`)

```tsx
<LinearGradient
    colors={[...]}
    style={styles.container}  // flex: 1, fills entire screen
>
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {/* Content */}
    </SafeAreaView>
</LinearGradient>
```

**Issue:**
- LinearGradient assumes full screen (`flex: 1`)
- SafeAreaView inside applies padding/insets
- Gradient background is visible, but content shifts
- Creates perception of content "sliding up" from behind the gradient

### Home Screen Structure (`index.tsx:157-189`)

```tsx
<LinearGradient colors={gradientColors} style={styles.container}>
    <View style={styles.safeArea}>  // No SafeAreaView!
        {/* Content */}
        <MiniPlayer />
    </View>
</LinearGradient>
```

**Difference:** Home uses a plain `View` instead of `SafeAreaView`, leading to inconsistent safe area handling.

---

## 8. Theme Color Update Timing

### Screen-Specific Color Setting

| Screen | When Colors Set | Method |
|--------|-----------------|--------|
| Home | On focus | `useFocusEffect` with `gradientColors[0]` |
| Reciter | After data loads | `useEffect` with `reciter.color_secondary` |
| Player | When track changes | `useEffect` with `currentTrack.reciterColorSecondary` |
| Settings/About | Never | Uses default theme |

**Problem:** No standardized color transition strategy. Each screen sets colors at different lifecycle points, causing StatusBar flash/stutter during navigation.

---

## 9. Underutilized Animation Libraries

### Installed but Not Used for Transitions

- `react-native-reanimated` v4.1.1 — installed but not used for screen transitions
- `react-native-gesture-handler` v2.28.0 — not used for transition gestures

**Current Animation Usage:**
- StatusBar: `animated={true}` (only for color)
- Screen transitions: Default expo-router behavior
- No shared element transitions
- No custom interpolations for color changes

---

## 10. Root Cause Summary

| Issue | Severity | Impact |
|-------|----------|--------|
| SafeArea `edges` mismatch between reciter and player | **HIGH** | Primary cause of shaking |
| StatusBar animation timing vs. layout update | **HIGH** | Color flash/stutter |
| Static layout calculations at module level | **MEDIUM** | Content misalignment |
| Absolute positioning without SafeArea consideration | **MEDIUM** | Button shift |
| No custom screen transition configuration | **MEDIUM** | Inconsistent animations |
| MiniPlayer bottom margin changes | **LOW-MEDIUM** | Sliding effect contribution |
| LinearGradient full-screen vs. SafeAreaView conflict | **MEDIUM** | Layout cascade |

---

## 11. Detailed Transition Flow Analysis

### Reciter → Player Transition (Most Problematic)

```
1. User taps MiniPlayer or plays surah
2. router.push("/player") called

3. IMMEDIATELY:
   - reciter/[id].tsx still visible
   - Player component mounts
   - player.tsx useEffect triggers setColors()

4. FRAME 1-2 (0-33ms):
   - ThemeContext updates
   - _layout.tsx re-renders
   - StatusBar begins color animation (300ms total)

5. FRAME 3-5 (33-83ms):
   - SafeAreaView on player applies edges=["top", "bottom"]
   - Content shifts up by insets.bottom (~34px on iPhone)
   - Reciter screen (edges=[]) fades out

6. FRAME 6-10 (83-166ms):
   - StatusBar still animating (halfway)
   - Player content already in final position
   - Visual disconnect = "shaking" perception

7. FRAME 10-18 (166-300ms):
   - StatusBar animation completes
   - All layouts stable
   - Transition complete
```

### Home → Player Transition

Similar flow, but home lacks SafeAreaView entirely, making the inset application even more abrupt.

---

## 12. Platform-Specific Considerations

### Android (`app.json` config)

```json
{
  "android": {
    "edgeToEdgeEnabled": true,
    "enableFreeze": false
  }
}
```

- Edge-to-edge mode means content extends behind system bars
- SafeAreaView must correctly handle both status bar and navigation bar
- Predictive back gesture is disabled (`enableFreeze: false`)

### iOS

- Notch/Dynamic Island handling differs
- StatusBar animation may be smoother by default
- Safe area insets are typically larger

**Current Issue:** No platform-specific SafeAreaView configurations exist.

---

## 13. Recommended Investigation Areas

### Immediate Focus

1. **Standardize SafeAreaView edges**
   - Decide on consistent edge configuration across all screens
   - Consider using `edges=["top"]` on all screens with bottom handled differently

2. **Batch theme updates**
   - Debounce or batch `setColors()` calls
   - Consider using `requestAnimationFrame` for synchronized updates

3. **Review navigation timing**
   - Investigate if `router.replace()` vs `router.push()` affects transition quality
   - Consider using shared element transitions

### Secondary Focus

4. **Dynamic layout calculations**
   - Move dimension calculations inside components
   - Use `useSafeAreaInsets()` hook for dynamic values

5. **Custom screen options**
   - Define explicit animation configurations in `_layout.tsx`
   - Consider using `react-native-reanimated` for smoother transitions

---

## 14. Affected Files Summary

| File | Lines of Interest | Issue Type |
|------|-------------------|------------|
| `app/_layout.tsx` | 53-71 | StatusBar config, Stack config |
| `app/player.tsx` | 53-129, 213-220, 382-393, 663-675 | Layout calc, theme update, SafeArea, absolute pos |
| `app/reciter/[id].tsx` | 38-40, 101-108, 411 | Static layout, theme update, SafeArea |
| `app/index.tsx` | 61-65, 157-189 | Theme update, no SafeAreaView |
| `src/components/MiniPlayer.tsx` | 68, 78 | Bottom margin calculation |
| `src/contexts/ThemeContext.tsx` | 20-27 | State management (no debouncing) |

---

## 15. Conclusion

The player screen transition issues stem from a combination of factors:

1. **SafeAreaView edge mismatch** is the primary cause of the shaking effect
2. **StatusBar animation timing** creates a race condition with layout updates
3. **Static layout calculations** don't adapt to changing safe area insets
4. **Lack of custom transition configurations** results in default, potentially inconsistent behavior

The "sliding from bottom" effect is primarily caused by the sudden application of bottom safe area insets when transitioning from a screen with no bottom insets to one that enforces them.

Addressing the SafeAreaView edge consistency across screens would likely resolve the majority of the visual glitches.
