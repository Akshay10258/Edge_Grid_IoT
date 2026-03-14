#!/usr/bin/env node
// Simple MQTT -> WebSocket bridge for EdgeGrid
// Subscribes to grid/# and broadcasts messages to connected WS clients.

import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import mqtt from "mqtt";

const MQTT_URL = "mqtt://10.147.59.249:1883";
const WS_PORT = process.env.WS_PORT || 3001;
const HTTP_PORT = process.env.HTTP_PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

const server = app.listen(HTTP_PORT, () => {
  console.log(`✅ MQTT→WS bridge running. HTTP/WS port: ${HTTP_PORT}`);
  console.log(`Connecting to MQTT broker: ${MQTT_URL}`);
});

const wss = new WebSocketServer({ server });

function broadcast(data) {
  const str = JSON.stringify(data);
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(str);
  });
}

// simple health endpoint
app.get("/health", (req, res) => res.json({ ok: true }));

// Manual control endpoint - sends MQTT commands to nodes
app.post("/control", (req, res) => {
  const { node, action } = req.body;

  if (!node || !action) {
    return res.status(400).json({ error: "Missing node or action" });
  }

  // Map frontend actions to ESP-compatible format
  const isManual = req.body.manual === true; // Check if manual control

  let command = {};
  if (action === "SHUTDOWN" || action === "OFF") {
    command = { shutdown: true, manual: isManual };
  } else if (action === "RESTORE" || action === "ON") {
    command = { restore: true, manual: isManual };
  } else {
    return res
      .status(400)
      .json({ error: "Invalid action. Use SHUTDOWN/RESTORE or ON/OFF" });
  }

  const topic = `grid/control/${node}`;
  const payload = JSON.stringify(command);

  console.log(`🎮 Control command: ${topic} -> ${payload}`);

  client.publish(topic, payload, (err) => {
    if (err) {
      console.error("Failed to publish command:", err);
      return res.status(500).json({ error: "Failed to send command" });
    }
    res.json({ success: true, node, action, command });
  });
});

// WebSocket connection logging
wss.on("connection", (ws) => {
  console.log("📡 New WebSocket client connected");
  ws.send(JSON.stringify({ event: "welcome", timestamp: Date.now() }));
});

// Connect to MQTT
const client = mqtt.connect(MQTT_URL);

client.on("connect", () => {
  console.log(" Connected to MQTT broker");
  // subscribe to all grid topics
  client.subscribe("grid/#", (err) => {
    if (err) console.error("Subscription error", err);
    else console.log("Subscribed to grid/#");
  });
});

client.on("error", (err) => {
  console.error("MQTT error", err.message || err);
});

client.on("message", (topic, payload) => {
  let msg = payload.toString();
  let parsed = null;
  try {
    parsed = JSON.parse(msg);
  } catch (e) {
    parsed = msg;
  }
  const out = { topic, data: parsed, ts: Date.now() };

  // Reduced logging - only log events, not summaries (too frequent)
  if (topic === "grid/events") {
    console.log(`🔔 ${msg}`);
  } else if (topic.startsWith("grid/leader/summary")) {
    // Silent - too frequent (every 50ms from loop)
  } else if (topic.startsWith("grid/heartbeat/")) {
    // Silent - too frequent (every 3s per node)
  } else {
    console.log(`${topic}`);
  }

  broadcast(out);
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  client.end(true);
  server.close(() => process.exit(0));
});
