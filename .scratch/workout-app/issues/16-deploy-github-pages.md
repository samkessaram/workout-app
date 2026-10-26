# 16: Deploy to GitHub Pages

**What to build:** Every push to the main branch builds the app and deploys it to GitHub Pages over HTTPS, so the PWA can be installed on the lifter's Android phone and updates reach it. Requires the repo to be under git with a GitHub remote.

**Blocked by:** 01 App shell and storage

**Status:** ready-for-agent

- [ ] Pushing to main triggers a build and deploy
- [ ] The deployed URL serves the app over HTTPS and passes installability checks
- [ ] The service worker serves the app offline after first load from the deployed URL
- [ ] A new deploy is picked up by an installed app on next open
