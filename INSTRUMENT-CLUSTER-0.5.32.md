# V.I.P LOGISTICS DELIVERY APP 0.5.32

- Redesigned the desktop dashboard to closely match the requested vehicle instrument-cluster UI.
- Speedometer: 0–240 KM/H.
- RPM gauge: 0–8,000 RPM.
- Added smooth requestAnimationFrame gauge motion driven by live TruckTel telemetry.
- Fixed SVG needle animation so CSS transform is used reliably instead of conflicting SVG transform attributes.
- Uses TruckTel engine/displayed gear fields for the center gear display.
- Preserved the working v0.5.28+ TruckTel WebSocket/event handling and automatic delivery workflow.
