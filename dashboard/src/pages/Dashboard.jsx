import React, { useMemo } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import TopBar from "../components/TopBar";
import KPICard from "../components/KPICard";
import CommStatsCard from "../components/CommStatsCard";
import ArchitectureDiagram from "../components/ArchitectureDiagram";
import LoadChart from "../components/LoadChart";
import NodeTable from "../components/NodeTable";
import EventLog from "../components/EventLog";
import ControlPanel from "../components/ControlPanel";
import {
  Zap,
  Server,
  AlertTriangle,
  Thermometer,
  Radio,
  Wifi,
} from "lucide-react";

/**
 * Main Dashboard Page
 */
const Dashboard = () => {
  // WebSocket connection - update URL to your backend WebSocket server
  const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";
  const { isConnected, gridData, events } = useWebSocket(WS_URL);

  // Calculate KPI metrics with enhanced logic and formatting
  // Optimized memoization - only recalculate when timestamp changes (less frequent)
  const metrics = useMemo(() => {
    const { total_load, nodes } = gridData;
    const onlineNodes = nodes?.filter((n) => n.status === "OK").length || 0;
    const offlineNodes =
      nodes?.filter((n) => n.status === "OFFLINE").length || 0;
    const shutdownNodes = nodes?.filter((n) => n.shutdown).length || 0;
    // Calculate average temperature
    const avgTemp =
      nodes && nodes.length > 0
        ? nodes.reduce((sum, n) => sum + (n.temp || 0), 0) / nodes.length
        : 0;
    // Determine overload status
    let overloadStatus = "OK";
    let overloadColor = "success";
    let overloadIcon = AlertTriangle;
    let overloadAnim = "";
    if (total_load > 25) {
      overloadStatus = "OVERLOAD";
      overloadColor = "danger";
      overloadAnim = "animate-pulse";
    } else if (total_load > 20) {
      overloadStatus = "WARNING";
      overloadColor = "warning";
      overloadAnim = "animate-bounce";
    }
    // System status subtitle
    let sysSubtitle = "";
    if (shutdownNodes > 0) sysSubtitle = `${shutdownNodes} node(s) shutdown`;
    else if (offlineNodes > 0) sysSubtitle = `${offlineNodes} offline`;
    else sysSubtitle = "All nodes healthy";
    return {
      totalLoad: total_load || 0,
      onlineNodes,
      avgTemp,
      overloadStatus,
      overloadColor,
      overloadIcon,
      overloadAnim,
      sysSubtitle,
      nodeCount: nodes?.length || 0,
    };
  }, [gridData.timestamp]);

  return (
    <div className="min-h-screen bg-dark-bg p-4 md:p-6 overflow-y-auto">
      <div className="max-w-[1920px] mx-auto space-y-6">
        {/* Top Bar */}
        <TopBar leaderNode={gridData.leader} isConnected={isConnected} />

        {/* KPI Cards Grid - Enhanced with animation, icons, and formatting */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <KPICard
            title="Total Load"
            value={metrics.totalLoad.toFixed(1)}
            suffix="kW"
            icon={Zap}
            color={
              metrics.totalLoad > 25
                ? "danger"
                : metrics.totalLoad > 20
                ? "warning"
                : "info"
            }
            subtitle={
              metrics.totalLoad > 25
                ? "Critical load!"
                : metrics.totalLoad > 20
                ? "High load"
                : "Stable"
            }
            trend={null}
          />
          <KPICard
            title="Nodes Online"
            value={metrics.onlineNodes}
            suffix={`/ ${metrics.nodeCount}`}
            icon={Server}
            color={
              metrics.onlineNodes === metrics.nodeCount
                ? "success"
                : metrics.onlineNodes === 0
                ? "danger"
                : "warning"
            }
            subtitle={
              metrics.onlineNodes === metrics.nodeCount
                ? "All nodes online"
                : metrics.onlineNodes === 0
                ? "No nodes online"
                : `${metrics.nodeCount - metrics.onlineNodes} offline`
            }
            trend={null}
          />
          <KPICard
            title="System Status"
            value={metrics.overloadStatus}
            icon={metrics.overloadIcon}
            color={metrics.overloadColor}
            subtitle={metrics.sysSubtitle}
            trend={null}
            className={metrics.overloadAnim}
          />
          <KPICard
            title="Avg Temperature"
            value={metrics.avgTemp.toFixed(1)}
            suffix={"\u00b0C"}
            icon={Thermometer}
            color={
              metrics.avgTemp > 40
                ? "danger"
                : metrics.avgTemp > 30
                ? "warning"
                : "warning"
            }
            subtitle={
              metrics.avgTemp > 40
                ? "Overheat risk!"
                : metrics.avgTemp > 30
                ? "Warm"
                : "Nominal"
            }
            trend={null}
          />
        </div>

        {/* Communication Performance Cards - Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <CommStatsCard
            title="MQTT Communication"
            rxCount={gridData.mqtt_rx || 0}
            txCount={gridData.mqtt_tx || 0}
            icon={Radio}
            color="info"
            isActive={isConnected && gridData.mqtt_rx > 0}
          />
          <CommStatsCard
            title="ESP-NOW Communication"
            rxCount={gridData.espnow_rx || 0}
            txCount={gridData.espnow_tx || 0}
            latency={gridData.espnow_latency || 0}
            icon={Wifi}
            color="primary"
            isActive={
              isConnected && (gridData.espnow_rx > 0 || gridData.espnow_tx > 0)
            }
          />
        </div>

        {/* Main Content Grid - Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Load Chart - Takes 2 columns */}
          <div className="lg:col-span-2">
            <LoadChart currentLoad={metrics.totalLoad} />
          </div>

          {/* Control Panel */}
          <div>
            <ControlPanel nodes={gridData.nodes} />
          </div>
        </div>

        {/* Hybrid Architecture Visualization - Row 4 */}
        <div className="mb-6">
          <ArchitectureDiagram
            leader={gridData.leader}
            nodes={gridData.nodes}
            mqtt_rx={gridData.mqtt_rx}
            espnow_rx={gridData.espnow_rx}
            espnow_tx={gridData.espnow_tx}
          />
        </div>

        {/* Bottom Grid - Row 5 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Node Table - Takes 2 columns */}
          <div className="lg:col-span-2">
            <NodeTable nodes={gridData.nodes} leader={gridData.leader} />
          </div>

          {/* Event Log */}
          <div className="h-[500px]">
            <EventLog events={events} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
