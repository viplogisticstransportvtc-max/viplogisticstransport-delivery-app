# Automatic Delivery Completion — v0.5.25

## Fix
The active delivery card could remain on the completed job when TruckTel emitted `job.delivered`, especially when the next job became active immediately or when the Vercel completion request needed a retry.

## Changes
- The completion request is tied to the exact `active_deliveries.id` that was completed.
- TruckTel's `job.delivered` distance is preferred for the final KM calculation.
- Completion retries automatically on transient API/server failures.
- If the server reports that the active delivery is already completed/closed, the client clears the stale card and refreshes from the server.
- The client refreshes the server immediately after a successful completion.
- The completed active delivery is cleared before the next job is displayed.
- Final odometer data is retried briefly if it is not available at the exact moment of the delivery event.
- Password/login, close-to-tray, automatic start, ATS/ETS2 support and TruckTel installation are unchanged.
