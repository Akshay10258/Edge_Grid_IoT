import React from "react";
import {
  Server,
  Thermometer,
  AlertCircle,
  Radio,
  Wifi,
  Power,
  Zap,
  Activity,
} from "lucide-react";

/**
 * NodeTable Component - Displays all nodes with their status, communication badges, and leader info
 */
const NodeTable = ({ nodes, leader }) => {
  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case "OK":
        return "bg-accent-success/20 text-accent-success border-accent-success/30";
      case "SHUTDOWN":
        return "bg-accent-danger/20 text-accent-danger border-accent-danger/30";
      case "OFFLINE":
        return "bg-gray-600/20 text-gray-400 border-gray-600/30";
      case "SHED":
        return "bg-accent-warning/20 text-accent-warning border-accent-warning/30";
      case "STALE":
        return "bg-accent-danger/20 text-accent-danger border-accent-danger/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString("en-US", { hour12: false });
  };

  const getTimeDiff = (timestamp) => {
    if (!timestamp) return null;
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const getTempLevel = (temp) => {
    if (!temp || temp <= -900) return { label: "N/A", color: "text-gray-400" };
    if (temp >= 40) return { label: "HIGH", color: "text-accent-danger" };
    if (temp >= 35) return { label: "MODERATE", color: "text-accent-warning" };
    return { label: "LOW", color: "text-accent-success" };
  };

  const getVibrationLevel = (vibration) => {
    if (vibration === undefined || vibration === null)
      return { label: "N/A", color: "text-gray-400" };
    if (vibration >= 2.0) return { label: "HIGH", color: "text-accent-danger" };
    if (vibration >= 1.0)
      return { label: "MODERATE", color: "text-accent-warning" };
    return { label: "LOW", color: "text-accent-success" };
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-accent-info/20">
          <Server className="w-5 h-5 text-accent-info" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Node Status</h2>
          <p className="text-sm text-gray-400">
            Live ESP32 node monitoring with communication paths
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                Node ID
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                Status
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                Load
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                Temp
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                Vibration
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                Comm
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                Last Seen
              </th>
            </tr>
          </thead>
          <tbody>
            {nodes && nodes.length > 0 ? (
              nodes.map((node, index) => {
                const isLeader = node.id === leader;
                const isShutdown = node.shutdown === true;
                const commPath = [];
                if (node.espnow) commPath.push("ESP-NOW");
                // MQTT is implicit for leader
                if (isLeader) commPath.push("MQTT");

                return (
                  <tr
                    key={node.id || index}
                    className={`border-b border-gray-800 hover:bg-white/5 transition-colors ${
                      isLeader
                        ? "bg-accent-success/5"
                        : isShutdown
                        ? "bg-accent-danger/5"
                        : ""
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {isLeader && (
                          <span
                            className="text-accent-success text-lg animate-pulse"
                            title="Leader Node"
                          >
                            ★
                          </span>
                        )}
                        <span className="font-medium text-white">
                          {node.id}
                        </span>
                        {isLeader && (
                          <span className="text-xs px-2 py-0.5 bg-accent-success/20 text-accent-success rounded-full border border-accent-success/30">
                            Leader
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                          node.status
                        )}`}
                      >
                        {node.status || "UNKNOWN"}
                      </span>
                      {isShutdown && (
                        <div className="text-xs text-accent-danger mt-1 flex items-center gap-1">
                          <Power className="w-3 h-3" />
                          Shutdown
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-accent-info" />
                        <span className="text-accent-info font-semibold">
                          {node.load?.toFixed(1) || "0.0"}
                        </span>
                        <span className="text-gray-500 text-sm">kW</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-accent-warning" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-white">
                              {node.temp?.toFixed(1) || "N/A"}
                            </span>
                            <span className="text-gray-500 text-sm">°C</span>
                          </div>
                          <span
                            className={`text-xs font-semibold ${
                              getTempLevel(node.temp).color
                            }`}
                          >
                            {getTempLevel(node.temp).label}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-accent-primary" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-white">
                              {node.vibration !== undefined &&
                              node.vibration !== null
                                ? node.vibration.toFixed(2)
                                : "N/A"}
                            </span>
                            <span className="text-gray-500 text-sm">g</span>
                          </div>
                          <span
                            className={`text-xs font-semibold ${
                              getVibrationLevel(node.vibration).color
                            }`}
                          >
                            {getVibrationLevel(node.vibration).label}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2 flex-wrap">
                        {node.espnow ? (
                          <span className="text-xs px-2 py-1 bg-accent-primary/20 text-accent-primary rounded-full border border-accent-primary/50 flex items-center gap-1">
                            <Wifi className="w-3 h-3" />
                            ESP-NOW
                          </span>
                        ) : null}
                        {isLeader ? (
                          <span className="text-xs px-2 py-1 bg-accent-info/20 text-accent-info rounded-full border border-accent-info/50 flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            MQTT
                          </span>
                        ) : null}
                        {!node.espnow && !isLeader ? (
                          <span className="text-xs px-2 py-1 bg-gray-700/20 text-gray-400 rounded-full border border-gray-700/50">
                            None
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <div className="text-sm text-gray-300">
                          {formatTimestamp(node.lastSeen)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getTimeDiff(node.lastSeen)}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="py-8 text-center text-gray-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No nodes detected</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default React.memo(NodeTable);
