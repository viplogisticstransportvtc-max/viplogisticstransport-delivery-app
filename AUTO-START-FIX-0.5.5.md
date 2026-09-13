# V.I.P Delivery Client 0.5.5 — Auto-Start Fix

This release strengthens ETS2 automatic delivery start for TruckTel on ETS2 1.60.x.

## Changes

- Uses TruckTel REST API on `127.0.0.1:8080`.
- Reads both structured and flat `job` REST data, improving compatibility when one representation is temporarily sparse.
- Treats a non-empty TruckTel job configuration as an active job when job fields are available.
- Automatic start no longer depends on receiving a `job-started` event; the current active job state is sufficient.
- Automatic start retries on the next telemetry poll if the VTC website rejects the request or if TruckTel job fields are still arriving.
- Adds clearer telemetry debug information including the job source and Auto-Start state.
- Keeps the existing successful automatic completion/submission workflow.
- Desktop client version is 0.5.5.

## Test

1. Start the V.I.P Delivery Client.
2. Connect with the TruckersMP username used by the VTC website.
3. Enable **AUTO-DETECT ETS2 JOB**.
4. Keep **AUTO-COMPLETE ON DELIVERY** enabled if desired.
5. Accept a normal ETS2 freight job.
6. Wait for the telemetry card to show `job=ACTIVE`.
7. The client should create the active delivery automatically using the current odometer as Start KM.

If automatic start is still blocked, the telemetry debug line now shows whether TruckTel reports `job=ACTIVE`, which job data source is being used, and whether Auto-Start is ON.
