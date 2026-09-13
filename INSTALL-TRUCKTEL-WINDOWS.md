# TruckTel Windows setup

Official project: https://github.com/jvanstraten/TruckTel

TruckTel is an open-source SCS telemetry bridge that exposes telemetry through REST/WebSocket HTTP APIs. Its documentation describes Windows support and REST endpoints.

## Build from source

Install:
- Visual Studio Build Tools with Desktop development with C++
- Git
- CMake

Then in PowerShell:

```powershell
git clone https://github.com/jvanstraten/TruckTel.git
cd TruckTel
cmake -S . -B build -A x64
cmake --build build --config Release
```

Use the resulting TruckTel DLL/application according to the project's installation instructions and put its plugin DLL in:

```text
Euro Truck Simulator 2\\bin\\win_x64\\plugins\\
```

Start TruckTel, then ETS2. Verify its local service is available before starting the V.I.P Delivery Client.
