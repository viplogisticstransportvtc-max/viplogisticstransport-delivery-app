# Release v0.5.42

## Automatic silent update installation

- Downloads updates automatically in the background.
- When an update finishes downloading, the app silently restarts and installs it.
- The update installer no longer opens a manual “Restart and Install” confirmation window.
- The active delivery is preserved because delivery state is stored by the backend.
- No manual update button is required.
- Uses the existing GitHub Releases / `latest.yml` update pipeline.
