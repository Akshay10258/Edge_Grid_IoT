import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom hook for WebSocket connection to receive live updates
 * @param {string} url - WebSocket server URL
 * @returns {object} - Connection state and latest data
 */
export const useWebSocket = (url) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [gridData, setGridData] = useState({
    leader: null,
    total_load: 0,
    timestamp: null,
    nodes: [],
    mqtt_rx: 0,
    mqtt_tx: 0,
    espnow_rx: 0,
    espnow_tx: 0,
  });
  const [events, setEvents] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const updateThrottleRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          setLastMessage(envelope);

          // Bridge sends: { topic, data: <payload>, ts }
          // Extract actual payload from the data field
          const payload = envelope.data || envelope;
          const topic = envelope.topic || "";

          // Handle grid/leader/summary updates with smart throttling
          if (
            topic === "grid/leader/summary" &&
            payload.leader !== undefined &&
            payload.nodes !== undefined
          ) {
            // Normalize the data structure
            const normalized = {
              leader: payload.leader,
              total_load: payload.total_load || 0,
              timestamp: payload.timestamp || Date.now(),
              mqtt_rx: payload.mqtt_rx || 0,
              mqtt_tx: payload.mqtt_tx || 0,
              espnow_rx: payload.espnow_rx || 0,
              espnow_tx: payload.espnow_tx || 0,
              espnow_latency: payload.espnow_latency || 0,
              nodes: (payload.nodes || []).map((node) => ({
                id: node.id,
                load: node.load || 0,
                temp: node.temp || 0,
                vibration:
                  node.vibration !== undefined && node.vibration !== null
                    ? node.vibration
                    : null,
                shutdown: node.shutdown || false,
                espnow: node.espnow !== undefined ? node.espnow : true,
                status:
                  node.shutdown === true
                    ? "SHUTDOWN"
                    : node.load === 0
                    ? "OFFLINE"
                    : "OK",
                lastSeen: payload.timestamp || Date.now(),
              })),
            };

            const now = Date.now();
            const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

            // Check for critical changes that need immediate update
            const nodeCountChanged =
              gridData.nodes?.length !== normalized.nodes.length;
            const leaderChanged = gridData.leader !== normalized.leader;
            const shutdownStateChanged = normalized.nodes.some(
              (n, i) => gridData.nodes?.[i]?.shutdown !== n.shutdown
            );
            const criticalChange =
              nodeCountChanged || leaderChanged || shutdownStateChanged;

            // Smart throttling: Immediate for critical changes, throttled for minor updates
            if (criticalChange || timeSinceLastUpdate > 300) {
              // Immediate update for critical changes or after 300ms
              setGridData(normalized);
              lastUpdateTimeRef.current = now;
            } else {
              // Throttle minor updates (load/temp changes) to reduce jitter
              if (updateThrottleRef.current) {
                clearTimeout(updateThrottleRef.current);
              }
              updateThrottleRef.current = setTimeout(() => {
                setGridData(normalized);
                lastUpdateTimeRef.current = Date.now();
              }, 300);
            }
          }

          // Handle grid/events updates
          if (topic === "grid/events" || payload.event) {
            // Enhanced event log: support color, type, comm path, etc.
            let eventType = "normal";
            let color = "blue";
            let commPath = [];
            let message =
              payload.event ||
              (typeof payload === "string" ? payload : JSON.stringify(payload));
            if (message.includes("shutdown")) {
              eventType = "shutdown";
              color = "red";
              if (message.includes("ESP-NOW")) commPath.push("espnow");
              if (message.includes("MQTT")) commPath.push("mqtt");
            } else if (message.includes("vibration")) {
              eventType = "vibration";
              color = "yellow";
              commPath.push("mqtt");
            } else if (message.includes("temperature")) {
              eventType = "temperature";
              color = "orange";
              commPath.push("mqtt");
            } else if (message.includes("elected")) {
              eventType = "election";
              color = "green";
            } else if (message.includes("emergency")) {
              eventType = "emergency";
              color = "yellow";
              commPath.push("espnow");
            } else if (message.includes("restored")) {
              eventType = "restoration";
              color = "green";
            }
            setEvents((prev) =>
              [
                {
                  id: Date.now(),
                  message,
                  timestamp: payload.timestamp || Date.now(),
                  type: eventType,
                  color,
                  commPath,
                },
                ...prev,
              ].slice(0, 50)
            ); // Keep last 50 events (reduced for performance)
          }
        } catch (error) {
          console.error(
            "Failed to parse WebSocket message:",
            error,
            event.data
          );
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket disconnected");
        setIsConnected(false);

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("🔄 Attempting to reconnect...");
          connect();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    lastMessage,
    gridData,
    events,
  };
};
