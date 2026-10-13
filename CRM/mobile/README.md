# FastonMed Android app

Android is the current release priority. The Capacitor app displays the deployed CRM with phone navigation and uses the existing CRM login, database and API routes. It needs an internet connection. This is a native container for the web CRM, not a separate Kotlin implementation. The iOS project is scaffolded only.

## Configure and test

Deploy the updated CRM first. From `CRM/mobile`:

```sh
npm ci
CRM_MOBILE_URL=https://YOUR-CRM-HOST/login npm run configure
npm run sync:android
npm run open:android
```

Choose a device or emulator in Android Studio and Run. The default unconfigured build displays a setup message and cannot be released. Only HTTPS server URLs are accepted. No API keys or CRM passwords belong in the app configuration. The application ID is `com.fastonmed.crm`; confirm ownership/availability in Play Console before the first upload.

## Google Play bundle

Create and securely back up an upload keystore through Android Studio's **Build → Generate Signed App Bundle / APK → Android App Bundle** wizard. For CLI builds, export these variables in your terminal (do not commit them):

- `FASTONMED_UPLOAD_KEYSTORE`: absolute keystore file path
- `FASTONMED_UPLOAD_STORE_PASSWORD`
- `FASTONMED_UPLOAD_KEY_ALIAS`
- `FASTONMED_UPLOAD_KEY_PASSWORD`
- `CRM_MOBILE_URL`: the deployed HTTPS CRM URL

Run `npm run release:android`. The signed bundle is written to `android/app/build/outputs/bundle/release/app-release.aab`. Release tasks reject missing HTTPS configuration or signing credentials. Increment `versionCode` in `android/app/build.gradle` for each subsequent upload. The project targets Android API 36 and supports Android 7.0+.

In Play Console, create FastonMed CRM under Business, enable Play App Signing, and upload the bundle to internal testing first. Complete app access instructions with a dedicated reviewer account, content rating, data safety, privacy policy URL, store screenshots, icon and feature graphic. Review the CRM's actual data handling before completing declarations; this repository does not establish a privacy policy or reviewer credentials. Test login, logout, back navigation, clients, tasks, leads, attachments and loss/recovery of connectivity on a physical phone before promoting a release.

Official references: [App setup](https://support.google.com/googleplay/android-developer/answer/9859152), [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756).
