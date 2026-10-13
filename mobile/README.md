# FastonMed CRM mobile app

This app opens **https://crm.fastonmed.com** inside a native Android/iOS container. It uses the existing CRM itself: the same login, screens, role permissions, workflows, APIs and records. There is no separately implemented CRM or sample database.

The whole website is available, including dashboard, tasks, clients, people, leads, enquiries, quotations, invoices/payments, products, warranty/expiry, service calendars, service tickets, service tracking, AMC contracts, trader companies, brands, reports, employee management, workspace hub, marketing and settings. Access remains governed by the existing CRM account. Website updates appear in the app as they are deployed.

## Interactive phone preview

Run `npm run preview` in this folder, then open http://127.0.0.1:8092. The iPhone/Android frame embeds the actual production CRM. Sign in with your existing account to explore its screens. Fit to View and 100% controls let you compare its phone layout. This browser preview does not emulate native file pickers, printing or hardware back.

## Run on a phone

1. Install Node.js and dependencies with `npm ci` in this folder.
2. Run `npm run sync` to synchronize the Android and iOS projects.
3. Android: install Android Studio with its SDK and Java 21; run `npm run android`, select a phone/emulator and Run. Or run `npm run build:android` to generate `android/app/build/outputs/apk/debug/app-debug.apk`.
4. iPhone: install Xcode; run `npm run ios`, choose your Apple signing team and run on a device/simulator.

The app is already configured for the production CRM address. Sign in with your existing CRM credentials. Internet access is required.

## Mobile integrations

Capacitor provides native web views and file pickers for existing uploads. Android hardware back uses the existing web navigation. CRM CSV/blob exports invoke the native save-file picker; quotation printing invokes the native print dialog. Export/print messages are restricted to the main frame of `https://crm.fastonmed.com`. Exports currently support files up to 20 MB. Native helpers never sign users in or alter CRM data.

The launcher icon comes from the existing CRM brand assets. The Android offline screen offers retry; on iOS reconnect by relaunching if initial navigation fails. A blank/start screen only redirects to the actual CRM and does not introduce alternate workflows.

## Verification and remaining checks

`npm run check` checks that both packaged platforms target the production CRM and tests detached-anchor CSV export, immediate blob URL revocation, native printing, normal navigation, origin restrictions and oversized export handling.

Android native compilation and APK signature verification passed on 8 October 2026 with Java 21, Gradle 8.14.3 and Android API 36. The installable debug APK is `releases/FastonMed-CRM-1.0-debug.apk` (Android 7.0+); its SHA-256 checksum is beside it. This build opens the live HTTPS CRM and requires the existing CRM login. Physical-device and iOS testing remain pending. Verify login, navigation through every module, role visibility, record editing, photo/file uploads, downloads, printing, keyboard layout and reconnect behavior on physical devices before distributing. App Store/Play release signing and store submission are separate steps.

The former Antigravity app source has been removed from this folder. Its source backup is `/private/tmp/fastonmed-antigravity-mobile-backup.tgz`; temporary storage is not a permanent archive. Existing `.agents` instructions and the local `.env` were preserved; this app does not read that `.env`.
