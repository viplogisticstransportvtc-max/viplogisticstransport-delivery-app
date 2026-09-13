# Instrument Cluster UI — v0.5.29

The desktop delivery dashboard now uses a functional vehicle-style instrument cluster.

- Speedometer: 0–140 KM/H, driven by TruckTel speed telemetry.
- RPM gauge: 0–8 x1000 RPM, driven by TruckTel RPM telemetry.
- Center odometer: live TruckTel odometer in KM.
- Trip distance: current odometer minus the active delivery start KM.
- Current job, cargo, start KM, distance and fuel remain live.
- Existing v0.5.28 TruckTel WebSocket compatibility/reconnect logic is retained.
- Automatic delivery start/completion behavior is unchanged.
