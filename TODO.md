# Production & Google Play Release Checklist

Purpose: a concise, actionable checklist to make the app production-ready and publish it to Google Play.

1. Project metadata & versioning

-   Update `app.json` / `app.config.js`: `slug`, `name`, `version`, `android.package`, `versionCode`.
-   Ensure `package.json` scripts for builds are present (EAS / gradle workflows).

2. Android-specific configuration

-   Configure `android.manifest` values via `app.json` (`permissions`, `intentFilters`).
-   Set `android.adaptiveIcon`, `icon`, and launcher colors.
-   Remove debug-only permissions and ensure runtime permissions are requested gracefully.

3. Signing & Play App Signing

-   Generate a private signing key (keystore) or use EAS-managed keys.
-   If using the Play App Signing flow, register the app and upload the app bundle; keep the upload key secure.

4. Build system & CI

-   Choose a build path: EAS Build (recommended for Expo) or local native builds with Android Studio.
-   Add CI pipeline (GitHub Actions / Bitrise / CircleCI) to produce reproducible `aab` artifacts.

5. Release build configuration

-   Ensure JS bundling/minification is enabled and dev/debug flags are disabled.
-   Disable dev-only features (verbose logging, debug menus, mock servers).

6. Tests

-   Run unit tests: `npm test` / `yarn test`.
-   Run TypeScript checks: `npx tsc --noEmit`.
-   Add integration/e2e tests (Detox/Appium/Playwright) for critical flows.

7. Crash reporting & analytics

-   Integrate Crashlytics / Sentry and configure release keys.
-   Add analytics (optional) and ensure GDPR/consent flows if applicable.

8. Privacy, legal & store policy

-   Prepare a privacy policy URL and in-app privacy notices.
-   Add terms of service and GDPR/CCPA guidance if you collect personal data.

9. Assets & UI polish

-   Prepare high-quality icons, adaptive icons, and splash screens for Android.
-   Capture localized screenshots for Play Store listing in target languages.

10. Performance & size optimizations

-   Run bundle analysis; remove unused libraries and large assets.
-   Enable ProGuard/R8 rules for release builds if using bare workflow.

11. Localisation & accessibility

-   Ensure key screens are localized (strings) and accessible (labels, contrast).

12. User onboarding & first-run

-   Ensure first-run flows are solid and error-tolerant (offline handling, permissions).

13. Internal testing & QA

-   Create an internal testing track in Play Console and upload a signed AAB.
-   Distribute to testers, gather logs, and fix blocking issues.

14. Play Store listing

-   Prepare store listing: title, short description, full description, promotional graphics, screenshots, category.
-   Prepare contact info, privacy policy URL, and age rating content.

15. Release process

-   Upload to Internal -> Closed -> Open tracks progressively.
-   Monitor crash/ANR rates and user feedback after release.

16. Post-release monitoring & updates

-   Configure alerts (crash, ANR, high install failure rate).
-   Plan hotfix cadence and follow-up releases for feedback items.

Quick commands (Expo / EAS recommended)

-   Configure `app.json` then login to EAS and build:

```
npx eas login
npx eas build -p android --profile production
```

-   For local AAB (bare workflow):

```
cd android
./gradlew bundleRelease
```

Notes & next steps

-   Start by auditing `app.json` and `android` configs, then create the release keystore or enable EAS-managed signing.
-   Save this checklist and mark items done as you progress.

--
Generated checklist for production readiness and Google Play release.
