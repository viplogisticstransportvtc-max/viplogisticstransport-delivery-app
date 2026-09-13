# V.I.P LOGISTICS TRANSPORT DELIVERY APP 0.5.12

## ETS2 + ATS automatic support

The delivery client now supports TruckTel telemetry from both:

- Euro Truck Simulator 2 (ETS2) — TruckTel game ID `eut2`
- American Truck Simulator (ATS) — TruckTel game ID `ats`

The same automatic workflow is used for both games: when TruckTel reports a new job, the client starts the VTC delivery automatically; when TruckTel reports the job delivered, the client completes the delivery automatically.

## Automatic TruckTel installation

The Windows NSIS installer now runs a bundled installer script that:

1. Detects Steam installation locations from the Windows Steam registry entries and `libraryfolders.vdf`.
2. Checks every detected Steam library for ETS2 and ATS.
3. Downloads TruckTel v0.1.2 once.
4. Installs the TruckTel files into each detected game's `bin\\win_x64\\plugins` directory.
5. Continues installing the V.I.P application even if TruckTel cannot be downloaded.

If no game is detected during installation, `INSTALL-TRUCKTEL.cmd` remains available for a later manual retry.
