# V.I.P Delivery Client — Phase 3

Windows desktop client foundation for V.I.P LOGISTICS TRANSPORT VTC.

## Current features
- Connects to the VTC website API
- Driver identity by TruckersMP username
- Start delivery
- Active delivery screen
- Complete delivery
- Automatic odometer distance calculation
- Sends completed delivery to management approval

## Run locally
```bash
npm install
npm start
```

## Build Windows installer
```bash
npm install
npm run build:win
```

The installer will be created under `dist/`.

## Important
This phase is the desktop delivery client foundation. It does **not yet read ETS2 telemetry automatically**. The next telemetry phase can add a local telemetry bridge so the client can detect truck/odometer/job information from ETS2 rather than requiring manual KM entry.

Before distributing this client, the website API should also gain per-driver authentication/tokens rather than relying only on a username.

## Phase 4 — ETS2 Telemetry Bridge

The client now includes a local telemetry bridge on `127.0.0.1:25555`.

- `GET /telemetry` returns the latest telemetry JSON.
- `POST /telemetry` accepts telemetry JSON from an ETS2 telemetry adapter/plugin.
- The client displays connection status, odometer, speed and fuel.
- When telemetry provides an active job, the client can pre-fill route, cargo, truck, trailer and starting KM.
- While a V.I.P delivery is active, the live odometer is used as the suggested ending KM and distance.

The bridge is intentionally local-only. This release does **not** claim that ETS2 automatically supplies these values by itself; an ETS2 telemetry plugin/adapter must send the JSON to the bridge. The next integration step is the Windows ETS2 telemetry plugin/adapter that translates SCS telemetry data into this format.

Example payload:

```json
{
  "game":"ETS2",
  "truck":"Scania S",
  "trailer":"Curtainsider",
  "speedKmh":82,
  "odometerKm":125430.7,
  "fuelLiters":410,
  "fuelPct":72,
  "gear":"12",
  "rpm":1100,
  "origin":"London",
  "destination":"Berlin",
  "cargo":"Rice",
  "jobActive":true,
  "jobFinished":false
}
```

## Driver Login 0.5.8

Drivers now sign in with their V.I.P LOGISTICS TRANSPORT VTC username and password. The VTC website URL and TruckersMP username are no longer entered by the driver. See `../DRIVER-LOGIN-SETUP.md` for account creation and deployment instructions.
