# Backend Scripts

This directory contains various utility and maintenance scripts for the backend.

## Structure

*   **`seeds/`**: Scripts to populate the database with initial or test data.
    *   `seed-cameras.js`: Creates default cameras.
    *   `seed-dashboard-data.js`: Populates dashboard statistics.
    *   `seed-zones.js`: Sets up parking zones.

*   **`demos/`**: Scripts and tools for demonstration purposes.
    *   `create-demo-camera.js`: Creates a specific demo camera.
    *   `init-parking-demo.sh`: Shell script to initialize the parking demo environment.

*   **`utils/`**: General utility and fix scripts.
    *   `fix-database.js`: Database repair tools.
    *   `fix-migrations.sql`: SQL migration fixes.
    *   `test-axios.js`: Network connectivity tests.
    *   `kill-port-5000.ps1`: Helper to kill the Python service port (Windows).

## Usage

To run these scripts, navigate to the `backend-hackathon` root and use `node`:

```bash
# Example: Run a seed script
node scripts/seeds/seed-cameras.js
```
