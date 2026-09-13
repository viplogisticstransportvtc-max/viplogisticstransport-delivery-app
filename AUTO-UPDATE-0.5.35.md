# Automatic Windows Updates — v0.5.35

The desktop app now uses Electron `electron-updater` with GitHub Releases.

## Release flow
1. Increase `package.json` version (for example `0.5.35` → `0.5.36`).
2. Build the Windows NSIS installer: `npm install` then `npm run build:win`.
3. Publish the generated NSIS installer and `latest.yml` release metadata to a GitHub Release for the matching version.
4. Installed V.I.P Delivery Apps check for updates shortly after startup and every 30 minutes.
5. Updates download automatically in the background.
6. The app shows `UPDATE READY` after download. If a delivery is active, installation is blocked until that delivery is finished.
7. When no delivery is active, the driver can press `RESTART & UPDATE`.

## GitHub repository
Owner: `viplogisticstransportvtc-max`
Repository: `viplog`
Provider: GitHub Releases

## Important
Auto-update works with packaged Windows builds, not `electron .` development mode. The first installed release containing this updater must be installed manually; subsequent releases can update automatically.
