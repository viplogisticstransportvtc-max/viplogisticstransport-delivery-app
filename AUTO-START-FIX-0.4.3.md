# V.I.P Delivery Client 0.4.3 — Automatic Start Fix

This build fixes two issues:

- ETS2 Telemetry no longer shows ONLINE merely because the local bridge is running or receiving a non-SDK packet. ONLINE now requires the telemetry payload to report an active SCS SDK connection.
- When AUTO-START ETS2 JOB is enabled and the driver is connected to the VTC website, a live ETS2 job automatically creates the delivery. The manual Start Delivery card is hidden in this mode.

The automatic start waits for a genuine telemetry connection and a valid odometer plus origin, destination, and cargo. It uses a signature to avoid duplicate starts.

Manual Start Delivery remains available when AUTO-START ETS2 JOB is disabled.
