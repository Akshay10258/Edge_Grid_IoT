import React from "react";
import { Radio, Wifi, Server } from "lucide-react";

/**
 * Hybrid Architecture Visualization Component
 * Displays MQTT + ESP-NOW hybrid communication architecture with leader and node status
 */
const ArchitectureDiagram = ({
  leader,
  nodes = [],
  mqtt_rx = 0,
  espnow_rx = 0,
  espnow_tx = 0,
}) => {
  const onlineNodes = nodes?.filter((n) => n.status === "OK").length || 0;
  const espnowNodes = nodes?.filter((n) => n.espnow).length || 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-accent-primary/20">
          <Server className="w-5 h-5 text-accent-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            Hybrid Architecture
          </h2>
          <p className="text-sm text-gray-400">
            MQTT + ESP-NOW Communication Topology
          </p>
        </div>
      </div>

      {/* Architecture Diagram */}
      <div className="space-y-6">
        {/* MQTT Path */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-accent-info/20 border border-accent-info/50 flex items-center justify-center">
            <Radio className="w-6 h-6 text-accent-info" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">MQTT Broker</h3>
              <span className="text-xs px-2 py-1 bg-accent-info/20 text-accent-info rounded-full">
                {mqtt_rx} messages
              </span>
            </div>
            <div className="h-1 bg-gradient-to-r from-accent-info/50 to-accent-info/20 rounded-full">
              <div
                className="h-full bg-accent-info/80 rounded-full animate-pulse"
                style={{ width: "60%" }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Broker: 10.11.138.249:1883 • Reliable, low-latency control
              messages
            </p>
          </div>
        </div>

        {/* ESP-NOW Path */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-accent-primary/20 border border-accent-primary/50 flex items-center justify-center">
            <Wifi className="w-6 h-6 text-accent-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">
                ESP-NOW Network
              </h3>
              <span className="text-xs px-2 py-1 bg-accent-primary/20 text-accent-primary rounded-full">
                RX: {espnow_rx} TX: {espnow_tx}
              </span>
            </div>
            <div className="h-1 bg-gradient-to-r from-accent-primary/50 to-accent-primary/20 rounded-full">
              <div
                className="h-full bg-accent-primary/80 rounded-full animate-pulse"
                style={{ width: "75%" }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Peer-to-Peer • Fast data exchange between nodes, minimal overhead
            </p>
          </div>
        </div>

        {/* Leader and Nodes Status */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700/30">
          {/* Leader */}
          <div className="bg-black/30 rounded-lg p-4 border border-accent-success/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-accent-success animate-pulse"></div>
              <h4 className="text-sm font-semibold text-white">Leader Node</h4>
            </div>
            <p className="text-lg font-bold text-accent-success">
              {leader || "None"}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Orchestrates grid control via MQTT
            </p>
          </div>

          {/* Node Statistics */}
          <div className="bg-black/30 rounded-lg p-4 border border-accent-warning/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-accent-warning animate-pulse"></div>
              <h4 className="text-sm font-semibold text-white">Nodes Status</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Online:</span>
                <span className="text-accent-success font-semibold">
                  {onlineNodes}/{nodes.length || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">ESP-NOW:</span>
                <span className="text-accent-primary font-semibold">
                  {espnowNodes}/{nodes.length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Communication Flow */}
        <div className="bg-gradient-to-r from-accent-info/10 to-accent-primary/10 border border-dashed border-gray-600/50 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            Data Flow
          </h4>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Radio className="w-3 h-3 text-accent-info" />
              <span>MQTT: Leader broadcasts control commands to all nodes</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="w-3 h-3 text-accent-primary" />
              <span>
                ESP-NOW: Nodes exchange telemetry and sync data peer-to-peer
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Server className="w-3 h-3 text-accent-warning" />
              <span>
                Bridge: WebSocket relay aggregates both paths for dashboard
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchitectureDiagram;
