# V.I.P LOGISTICS DELIVERY APP 0.5.27 — TruckTel WebSocket Fix

This release fixes and diagnoses the TruckTel event-stream connection used for automatic delivery completion.

## What changed
- Uses `ws://127.0.0.1:8080/api/ws/event?throttle=0`.
- Explicitly disables per-message compression for compatibility.
- Supports both Node `ws` EventEmitter and browser/Electron WebSocket event APIs.
- Automatically reconnects every second after a disconnect.
- Captures WebSocket handshake HTTP errors, connection errors, close codes/reasons, and connection attempts.
- Shows the WebSocket state directly in the app's TruckTel debug line.
- Keeps `job.delivered` as the authoritative completion event.
- Keeps `job.cancelled` as the authoritative cancellation event.
- Does not infer cancellation from a disappearing REST job.
- Retains the REST/odometer recovery only as a fallback when the WebSocket is genuinely unavailable.

TruckTel documents `/api/ws/event` as the event stream and `job.delivered` as the authoritative delivery event containing `distance.km`.
