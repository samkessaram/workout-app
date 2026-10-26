---
status: accepted
---

# PWA with on-device storage over native Android

The app is a single-user, offline-first PWA installed from GitHub Pages, with all data in on-device IndexedDB and no backend or sync. This is the fastest route to a usable gym app and keeps data private. Backup is manual JSON export, which loses data if the phone is lost between exports.

## Considered options

- **Native Kotlin + Compose**: reliable rest-timer notifications with the screen locked, but much slower to build.
- **Cloud sync / S3**: multi-device and recoverable, but needs a backend, credentials and network at the gym.

## Consequences

- The rest timer cannot alert when the phone is locked. It only vibrates and beeps while the app is open. If this proves painful, wrapping the PWA in a native shell is the planned fix.
- No sync means one device only, and backup depends on the lifter exporting regularly (the app nudges after 14 days).
