/**
 * Mock Backend Server for Testing
 *
 * This is a simple Express + WebSocket server that simulates
 * the EdgeGrid backend for testing the dashboard.
 *
 * To run:
 * 1. npm install
 * 2. npm run test-server
 * 3. Open dashboard at http://localhost:3000
 */

import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`✅ Mock server running on http://localhost:${PORT}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Mock data state
let currentData = {
  leader: "Node-1",
  total_load: 15.5,
  timestamp: Math.floor(Date.now() / 1000),
  nodes: [
    {
      id: "Node-1",
      load: 5.2,
      temp: 28.5,
      isLeader: true,
      status: "OK",
      lastSeen: Math.floor(Date.now() / 1000),
    },
    {
      id: "Node-2",
      load: 4.8,
      temp: 29.1,
      isLeader: false,
      status: "OK",
      lastSeen: Math.floor(Date.now() / 1000),
    },
    {
      id: "Node-3",
      load: 5.5,
      temp: 27.9,
      isLeader: false,
      status: "OK",
      lastSeen: Math.floor(Date.now() / 1000),
    },
  ],
};

// Broadcast to all connected clients
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      // WebSocket.OPEN = 1
      client.send(JSON.stringify(data));
    }
  });
}

// WebSocket connection handler
wss.on("connection", (ws) => {
  console.log("📡 New WebSocket client connected");

  // Send initial data
  ws.send(JSON.stringify(currentData));

  ws.on("close", () => {
    console.log("🔌 Client disconnected");
  });
});

// REST API - Control endpoint
app.post("/control", (req, res) => {
  const { node, action } = req.body;

  console.log(`🎛️  Control command: ${action} → ${node}`);

  // Broadcast event
  broadcast({
    event: `Manual ${action} command sent to ${node}`,
    timestamp: Math.floor(Date.now() / 1000),
  });

  res.json({ success: true, message: `Command sent to ${node}` });
});

// Simulate live data updates
setInterval(() => {
  // Randomly update loads and temperatures
  currentData.nodes = currentData.nodes.map((node) => ({
    ...node,
    load: Math.max(0, node.load + (Math.random() - 0.5) * 2),
    temp: Math.max(20, Math.min(40, node.temp + (Math.random() - 0.5) * 0.5)),
    lastSeen: Math.floor(Date.now() / 1000),
  }));

  // Calculate total load
  currentData.total_load = currentData.nodes.reduce(
    (sum, n) => sum + n.load,
    0,
  );
  currentData.timestamp = Math.floor(Date.now() / 1000);

  // Randomly change status
  if (Math.random() > 0.95) {
    const randomNode =
      currentData.nodes[Math.floor(Math.random() * currentData.nodes.length)];
    const oldStatus = randomNode.status;
    randomNode.status = Math.random() > 0.5 ? "SHED" : "OK";

    if (oldStatus !== randomNode.status) {
      broadcast({
        event: `${randomNode.id} status changed: ${oldStatus} → ${randomNode.status}`,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  }

  // Broadcast updated data
  broadcast(currentData);
}, 2000); // Update every 2 seconds

// Generate random events
setInterval(() => {
  const events = [
    "Grid load stabilized",
    "Temperature within normal range",
    "All nodes responding normally",
    "Power distribution optimized",
  ];

  const randomEvent = events[Math.floor(Math.random() * events.length)];

  broadcast({
    event: randomEvent,
    timestamp: Math.floor(Date.now() / 1000),
  });
}, 10000); // Random event every 10 seconds
