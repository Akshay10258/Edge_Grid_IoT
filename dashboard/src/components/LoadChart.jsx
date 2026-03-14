import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts";
import { Activity } from "lucide-react";

/**
 * LoadChart Component - Displays grid load over time with threshold lines
 */
const LoadChart = ({ currentLoad }) => {
  const [chartData, setChartData] = useState([]);
  const lastUpdateRef = useRef(0);

  // Threshold constants (in kW)
  const NOMINAL_THRESHOLD = 20; // Yellow warning
  const CRITICAL_THRESHOLD = 25; // Red critical

  useEffect(() => {
    if (currentLoad !== null && currentLoad !== undefined) {
      const now = Date.now();

      // Throttle chart updates to every 1 second for smooth but responsive updates
      if (now - lastUpdateRef.current < 1000) {
        return;
      }

      lastUpdateRef.current = now;
      const timeStr = new Date(now).toLocaleTimeString("en-US", {
        hour12: false,
      });

      setChartData((prev) => {
        const newData = [
          ...prev,
          {
            time: timeStr,
            load: parseFloat(currentLoad.toFixed(2)),
            timestamp: now,
          },
        ];

        // Keep last 30 data points for smoother visualization
        return newData.slice(-30);
      });
    }
  }, [currentLoad]);

  // Custom tooltip with threshold info
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      let status = "Normal";
      let statusColor = "text-accent-success";
      if (value > CRITICAL_THRESHOLD) {
        status = "Critical";
        statusColor = "text-accent-danger";
      } else if (value > NOMINAL_THRESHOLD) {
        status = "Warning";
        statusColor = "text-accent-warning";
      }
      return (
        <div className="glass-card p-3 border border-accent-primary/30">
          <p className="text-sm text-gray-300">
            Load:{" "}
            <span className="text-accent-info font-semibold">{value} kW</span>
          </p>
          <p className={`text-xs font-semibold ${statusColor}`}>{status}</p>
          <p className="text-xs text-gray-500">{payload[0].payload.time}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-accent-primary/20">
          <Activity className="w-5 h-5 text-accent-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Total Grid Load</h2>
          <p className="text-sm text-gray-400">
            Real-time power consumption with thresholds
          </p>
        </div>
      </div>

      {/* Threshold Legend */}
      <div className="mb-4 flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-success"></div>
          <span className="text-gray-400">
            Nominal (&lt;{NOMINAL_THRESHOLD}kW)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-warning"></div>
          <span className="text-gray-400">
            Warning ({NOMINAL_THRESHOLD}-{CRITICAL_THRESHOLD}kW)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-danger"></div>
          <span className="text-gray-400">
            Critical (&gt;{CRITICAL_THRESHOLD}kW)
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis
            dataKey="time"
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
            tick={{ fill: "#9ca3af" }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
            tick={{ fill: "#9ca3af" }}
            label={{
              value: "Load (kW)",
              angle: -90,
              position: "insideLeft",
              fill: "#9ca3af",
            }}
            domain={[0, 30]}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Threshold Lines */}
          <ReferenceLine
            y={NOMINAL_THRESHOLD}
            stroke="#eab308"
            strokeDasharray="5 5"
            label={{
              value: "Warning",
              fill: "#eab308",
              fontSize: 12,
              position: "right",
            }}
          />
          <ReferenceLine
            y={CRITICAL_THRESHOLD}
            stroke="#ef4444"
            strokeDasharray="5 5"
            label={{
              value: "Critical",
              fill: "#ef4444",
              fontSize: 12,
              position: "right",
            }}
          />

          {/* Load Line */}
          <Line
            type="monotone"
            dataKey="load"
            stroke="#22d3ee"
            strokeWidth={3}
            dot={{ fill: "#22d3ee", r: 4 }}
            activeDot={{
              r: 6,
              fill: "#22d3ee",
              stroke: "#0d1117",
              strokeWidth: 2,
            }}
            fill="url(#loadGradient)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(LoadChart);
