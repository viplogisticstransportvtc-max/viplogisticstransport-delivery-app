# Phase 6 — ETS2 Delivery Automation

This phase builds on Phase 5 and adds safer job-state automation around the existing local telemetry bridge.

## What it does
- Detects the transition from no ETS2 job to an active ETS2 job.
- Uses live telemetry to prefill starting KM, route, cargo, truck and trailer when **AUTO-DETECT ETS2 JOB** is enabled.
- While a V.I.P delivery is active, continuously uses the ETS2 odometer as the ending-KM suggestion.
- Detects the ETS2 job-finished transition.
- When **AUTO-COMPLETE ON DELIVERY** is enabled, submits the active V.I.P delivery using the final telemetry odometer.
- Otherwise, it fills the final KM and asks the driver to review and press **COMPLETE DELIVERY**.
- Auto settings are saved locally on the PC.

## Safety behavior
The client does not silently create a V.I.P delivery merely because ETS2 is running. Auto-detection prepares the delivery fields; the driver can then start the V.I.P delivery. Automatic completion only applies to an already-active V.I.P delivery.

## Telemetry requirement
An ETS2 telemetry provider must be running and publishing data to `http://127.0.0.1:25555/telemetry`. The client cannot invent game telemetry if ETS2 or the provider is unavailable.

## Test
1. Connect the client to the deployed VTC website.
2. Enable **AUTO-DETECT ETS2 JOB**.
3. Start an ETS2 freight job.
4. Confirm the route/cargo/starting KM appear.
5. Press **START DELIVERY**.
6. Drive and verify the ending KM changes with the ETS2 odometer.
7. Finish the ETS2 job.
8. Review the final KM, or enable **AUTO-COMPLETE ON DELIVERY** for automatic submission.


## Automatic delivery start

When **AUTO-START ETS2 JOB** is enabled, a new ETS2 job transition (`jobActive: false -> true`) automatically creates the active delivery on the VTC website. The client uses the live odometer as starting KM and copies origin, destination, cargo, truck, and trailer from telemetry. If an active delivery already exists, it is not duplicated. If required route/cargo telemetry is missing, the client leaves the delivery unstarted and displays an error.
