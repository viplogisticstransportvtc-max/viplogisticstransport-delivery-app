# TruckTel WebSocket compatibility fix — v0.5.28

The installed TruckTel build reported `missing structure in /api/ws/event`.

The adapter now tries the documented event endpoint and compatibility endpoints that include a structure segment: `/api/ws/event`, `/api/ws/event/flat`, `/api/ws/event/struct`, and `/api/ws/event/single`. The active path is displayed in the debug line.

Explicit `job.delivered` and `job.cancelled` events remain authoritative.
