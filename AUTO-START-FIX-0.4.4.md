# Auto-start 0.4.4

Improves ETS2 job detection using both the SDK `onJob` flag and a populated current-job payload (`citySrc`, `cityDst`, `cargo`, `jobStartingTime`, `plannedDistanceKm`, `jobIncome`). This handles telemetry plugin revisions where `onJob` can flicker while job data is already present.

Also exposes jobDelivered/jobCancelled and job metadata through the local telemetry bridge and changes the connected message to `Connected to ETS2 — waiting for a job…` when no job is active.
