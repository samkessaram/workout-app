# 16: Deploy to GitHub Pages

**What to build:** Every push to the main branch builds the app and deploys it to GitHub Pages over HTTPS, so the PWA can be installed on the lifter's Android phone and updates reach it. Requires the repo to be under git with a GitHub remote.

**Blocked by:** 01 App shell and storage

**Status:** ready-for-agent

- [x] Pushing to main triggers a build and deploy
- [x] The deployed URL serves the app over HTTPS and passes installability checks
- [x] The service worker serves the app offline after first load from the deployed URL
- [x] A new deploy is picked up by an installed app on next open
