# V.I.P Delivery Client 0.5.3 — TruckTel Port Fix

This version fixes the ETS2 1.60 TruckTel connection.

## Correct TruckTel endpoints

- Landing page: `http://127.0.0.1:8079`
- TruckTel REST API: `http://127.0.0.1:8080`
- TruckTel event WebSocket: `ws://127.0.0.1:8080/api/ws/event`

The previous client incorrectly queried port 8079, which serves the landing page HTML. Version 0.5.3 queries port 8080 for JSON telemetry.

## Automatic delivery workflow

With **AUTO-START ETS2 JOB** enabled:

1. Start/accept a job in ETS2.
2. TruckTel reports the current job.
3. The client fills route, cargo, truck, trailer and starting odometer.
4. The client creates the V.I.P delivery automatically.
5. Live odometer data updates the ending KM.
6. TruckTel's `job.delivered` event is listened for through WebSocket.
7. With **AUTO-COMPLETE ON DELIVERY** enabled, the delivery is submitted automatically.

If the event WebSocket is temporarily unavailable, the client also falls back to detecting the job disappearing after a short debounce period.

## Important

TruckTel must be running in ETS2 and the V.I.P Delivery Client must be connected to your VTC website before accepting a job.
