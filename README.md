# EdgeGrid Hybrid Dashboard

EdgeGrid Hybrid Dashboard is a React-based monitoring and control UI for a distributed smart-grid prototype that uses:

- MQTT for broker-based messaging
- ESP-NOW for peer-to-peer telemetry between nodes
- A Node.js bridge to fan MQTT data out to WebSocket clients and accept control commands

This repository contains the dashboard frontend, backend bridge, and firmware source in one place.

## What This Project Does

- Displays live node telemetry (load, temperature, status)
- Shows total grid load and node-level health
- Visualizes communication performance (MQTT and ESP-NOW)
- Streams and classifies system events
- Sends manual control commands (ON, OFF, SHUTDOWN, RESTORE)

## System Architecture

`ESP nodes -> MQTT broker -> backend/mqtt-bridge.js -> WebSocket + REST -> React dashboard`

Runtime defaults:

- Dashboard (Vite dev): `http://localhost:5173`
- Bridge HTTP and WebSocket: `http://localhost:3001` and `ws://localhost:3001`

## Updated Folder Structure

```text
edgegrid-dashboard/
|-- backend/
|   |-- mqtt-bridge.js        # MQTT <-> WebSocket/REST bridge
|   `-- test-server.js
|
|-- dashboard/
|   |-- dist/                 # Production build output
|   |-- index.html
|   |-- postcss.config.js
|   |-- tailwind.config.js
|   |-- vite.config.js
|   `-- src/
|       |-- api/
|       |   `-- index.js
|       |-- components/
|       |   |-- ArchitectureDiagram.jsx
|       |   |-- CommStatsCard.jsx
|       |   |-- ControlPanel.jsx
|       |   |-- EventLog.jsx
|       |   |-- KPICard.jsx
|       |   |-- LoadChart.jsx
|       |   |-- Loading.jsx
|       |   |-- NodeTable.jsx
|       |   |-- StatusBadge.jsx
|       |   |-- TopBar.jsx
|       |   `-- index.js
|       |-- hooks/
|       |   `-- useWebSocket.js
|       |-- pages/
|       |   `-- Dashboard.jsx
|       |-- App.jsx
|       |-- index.css
|       `-- main.jsx
|
|-- firmware/
|   `-- arduino/
|       `-- eap8266.ino
|
|-- .env
|-- package.json
`-- README.md
```

## Prerequisites

- Node.js 18+ (recommended)
- npm 9+
- Running MQTT broker reachable from this machine
- Firmware publishing heartbeat/summary/events topics

## Installation

```bash
npm install
```

## Environment Configuration

Root `.env` values used by frontend:

```env
VITE_WS_URL=ws://localhost:3001
VITE_API_URL=http://localhost:3001
```

Important:

- The frontend reads `VITE_WS_URL` and `VITE_API_URL`.
- The bridge MQTT broker URL is currently hardcoded in `backend/mqtt-bridge.js` as `MQTT_URL`.

If your broker IP changes, update this line in `backend/mqtt-bridge.js`:

```js
const MQTT_URL = "mqtt://<your-broker-ip>:1883";
```

## Run the Project

Use two terminals.

1. Start MQTT bridge:

```bash
npm run mqtt-bridge
```

Expected bridge output includes:

- Bridge startup on port 3001
- MQTT connected and subscribed to `grid/#`

2. Start dashboard:

```bash
npm run dev
```

Open: `http://localhost:5173`

## Available npm Scripts

From `package.json`:

- `npm run dev` - start Vite dev server for dashboard
- `npm run build` - build dashboard to `dashboard/dist`
- `npm run preview` - preview production build
- `npm run mqtt-bridge` - run MQTT/WebSocket/REST bridge
- `npm run test-server` - run test backend server

## MQTT Topics and Data Flow

Bridge subscribes to:

- `grid/#`

Observed high-frequency topics include:

- `grid/heartbeat/<node-id>`
- `grid/leader/summary`
- `grid/events`

Frontend hook (`dashboard/src/hooks/useWebSocket.js`) expects WebSocket envelopes like:

```json
{
  "topic": "grid/leader/summary",
  "data": { "leader": "Node-1", "nodes": [] },
  "ts": 1710000000000
}
```

The dashboard also handles:

- `grid/events`
- node status fields such as `shutdown`, `espnow`, `load`, `temp`

## Manual Control API

Bridge exposes POST `/control` on port 3001.

Request body:

```json
{
  "node": "Node-1",
  "action": "SHUTDOWN",
  "manual": true
}
```

Supported actions:

- `ON` or `RESTORE`
- `OFF` or `SHUTDOWN`

The bridge publishes commands to:

- `grid/control/<node>`

## Common Troubleshooting

### Dashboard loads but nodes disappear after refresh

Likely causes:

- Bridge is receiving only heartbeat topics while UI waits for summary topic data
- Summary packets are delayed or not published after reconnect

Checks:

1. Confirm bridge terminal is connected to MQTT and subscribed.
2. Confirm WebSocket client reconnects in browser dev tools.
3. Confirm `grid/leader/summary` is being published continuously.
4. Confirm `VITE_WS_URL` points to the running bridge instance.

### Control buttons do nothing

Checks:

1. Confirm `VITE_API_URL` is `http://localhost:3001` (or your bridge host).
2. Verify POST `/control` returns success.
3. Verify node IDs in UI match subscribed node topic naming.

### Bridge starts but no MQTT messages

Checks:

1. Verify broker IP in `backend/mqtt-bridge.js`.
2. Verify broker port and network/firewall accessibility.
3. Verify firmware is publishing under `grid/#`.

## Development Notes

- Frontend source of truth: `dashboard/src/pages/Dashboard.jsx`
- WebSocket normalization and event typing: `dashboard/src/hooks/useWebSocket.js`
- Message routing and control publishing: `backend/mqtt-bridge.js`
- Tailwind styles and theme: `dashboard/src/index.css` and `dashboard/tailwind.config.js`

## Build for Production

```bash
npm run build
npm run preview
```

Build output is generated in:

- `dashboard/dist`

## License

MIT
