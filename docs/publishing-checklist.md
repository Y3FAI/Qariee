# Google Play Publishing Checklist for Rabi App

## 📱 App Configuration (Current Status)

### ✅ Already Configured
- [x] **App name**: "Rabi" (renamed from "qariee")
- [x] **Bundle ID**: `com.yousef54ai.rabi` (Android package)
- [x] **Version**: 1.0.0 (in app.json)
- [x] **Android adaptive icons**: Configured in app.json
- [x] **Permissions**: WAKE_LOCK, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS
- [x] **Background audio**: Enabled via expo-media-control plugin
- [x] **Notification channel**: "Rabi Playback" configured

### ⚠️ Needs Attention
- [ ] **EAS Build configuration** (`eas.json` not found)
- [ ] **App signing key** (new key needed for new bundle ID)
- [ ] **Privacy policy URL** (required for Google Play)
- [ ] **Content rating questionnaire** (to be completed)

## 🚀 Publishing Steps

### Phase 1: Preparation & Build
1. **Set up EAS Build**
   ```bash
   npm install -g eas-cli
   eas login
   eas init
   ```
   - Create `eas.json` with Android build profiles
   - Configure app version and build numbers

2. **Configure app signing**
   - Let Google Play manage app signing (recommended)
   - Generate upload key and register with Google Play Console

3. **Build Android App Bundle (AAB)**
   ```bash
   eas build --platform android --profile preview
   ```
   - Test with internal testing track
   - Verify background audio, notifications, offline downloads

### Phase 2: Google Play Console Setup
4. **Create new app listing**
   - App name: "Rabi"
   - Short description: "Quran recitation app with offline listening"
   - Full description: Write compelling description
   - App type: "Applications" → "Music & Audio"

5. **Store listing assets**
   - **Feature graphic**: 1024×500px PNG
   - **Phone screenshots**: 5-8 screenshots (1080×1920px)
   - **7-inch tablet screenshots**: Optional
   - **10-inch tablet screenshots**: Optional
   - **Promo video**: Optional but recommended
   - **High-res icon**: 512×512px PNG

6. **Content rating**
   - Complete content rating questionnaire
   - Likely rating: "Everyone" (no violence, no explicit content)
   - Quran content is religious/educational

7. **Privacy policy**
   - Create privacy policy page (GitHub Pages, Simple PDF)
   - Must disclose: Audio streaming, file downloads, app analytics
   - URL required even if no data collection

### Phase 3: Testing & Release
8. **Upload AAB to testing tracks**
   - Internal testing (team only)
   - Alpha testing (expanded group)
   - Beta testing (open beta)

9. **Test thoroughly** (refer to `tests.md`)
   - Audio playback & background operation
   - Sleep timer reliability
   - Offline download & playback
   - Playback modes (sequential, shuffle, repeat)
   - Network state handling
   - App lifecycle & state restoration

10. **Production release**
    - Set release notes (Arabic & English)
    - Choose release type: "Production"
    - Initial rollout: 10% → 50% → 100% (staged rollout)
    - Monitor crash reports & user feedback

## 🔧 Technical Requirements

### App Size Optimization
- Current APK size: ~30-50MB (estimate with audio files bundled?)
- Consider separating audio files to reduce initial download
- Use Android App Bundle for optimized delivery

### Permissions Justification
- `WAKE_LOCK`: Keep screen on during playback (optional)
- `RECORD_AUDIO`: Not actually needed for playback only - REMOVE
- `MODIFY_AUDIO_SETTINGS`: Adjust volume/audio routing - KEEP

**Action**: Remove `RECORD_AUDIO` permission from app.json

### Target SDK Requirements
- Target Android 13 (API 33) or higher required for new apps
- Expo default should handle this

### Accessibility
- Ensure sufficient color contrast
- Support talkback/voiceover
- Large touch targets

## 📝 Store Listing Content

### English Description
```
Rabi - Quran Recitation App

Listen to beautiful Quran recitations from famous reciters (Qaris) with a modern, Spotify-like experience.

Features:
• High-quality audio streaming
• Download for offline listening
• Sleep timer with fade-out
• Multiple playback modes (sequential, shuffle, repeat)
• Clean, intuitive interface
• Background playback support
• Lock screen controls

Perfect for daily listening, memorization, or relaxation.
```

### Arabic Description (الوصف العربي)
```
ربيع - تطبيق تلاوة القرآن الكريم

استمع إلى تلاوات القرآن الكريم بأصوات أشهر القراء بتجربة حديثة تشبه سبوتيفاي.

المميزات:
• بث صوتي بجودة عالية
• تحميل للاستماع بدون إنترنت
• مؤقت النوم مع تدرج الصوت
• أوضاع تشغيل متعددة (تسلسلي، عشوائي، تكرار)
• واجهة نظيفة وسهلة الاستخدام
• دعم التشغيل في الخلفية
• عناصر تحكم في شاشة القفل

مثالي للاستماع اليومي، الحفظ، أو الاسترخاء.
```

## ⚠️ Common Rejection Reasons

1. **Missing privacy policy** - Must have accessible URL
2. **Inaccurate content rating** - Complete questionnaire carefully
3. **Poor app quality** - Ensure no crashes, test thoroughly
4. **Inappropriate permissions** - Justify each permission
5. **Copyright issues** - Ensure audio files have proper licensing
6. **Incomplete store listing** - Provide all required assets

## 📊 Post-Release Monitoring

1. **Crash reports** (Google Play Console)
2. **User ratings & reviews** (respond to feedback)
3. **Install statistics** (countries, devices)
4. **Performance metrics** (ANR rate, battery usage)
5. **Update planning** (bug fixes, feature updates)

## 🛠️ Useful Commands

```bash
# Build for testing
eas build --platform android --profile preview

# Build for production
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android

# Update app version
expo-increment --android
```

## 📚 References

- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Expo EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Android App Bundle](https://developer.android.com/guide/app-bundle)
- [Privacy Policy Generator](https://app-privacy-policy-generator.nisrulz.com/)
