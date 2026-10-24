# Mochi's Secret Number: offline Android APK

This project wraps the supplied React/Vite game in a native Android WebView using Capacitor. The game code and image assets are packaged into the app, so gameplay does not require an internet connection. Best scores are saved locally on the device.

## Build an APK without installing Android Studio (GitHub Actions)

1. Create a new **private** repository on GitHub.
2. Upload the contents of this folder (not the folder itself as one nested directory). Include `.github/workflows/build-apk.yml`.
3. On GitHub, open **Actions** and allow workflows if prompted.
4. Select **Build Android APK**, choose **Run workflow**, and run it on `main`.
5. When it finishes successfully, open that workflow run and download the artifact named `Mochis-Secret-Number-Android-APK`.
6. Extract the downloaded artifact ZIP. It contains `app-debug.apk`.
7. Send the APK through WhatsApp as a **Document**. On each Android phone, the recipient downloads it, opens it, and allows installation from that source if Android asks. Only install APKs from people you trust.

The debug APK is suitable for personal testing and sharing with friends, not for publishing to Google Play. Android may show a warning because it is not signed with a public release key.

## Build locally (optional)

Requires Node.js 22, Java 21, Android Studio/Android SDK.

```bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.
