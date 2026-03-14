import React from "react";

/**
 * Communication Stats Card Component
 * Displays MQTT or ESP-NOW communication statistics with badges and animations
 */
const CommStatsCard = ({
  title,
  rxCount,
  txCount,
  latency,
  icon: Icon,
  color,
  isActive = true,
}) => {
  const colorClasses = {
    primary:
      "from-accent-primary/20 to-accent-primary/5 border-accent-primary/30",
    success:
      "from-accent-success/20 to-accent-success/5 border-accent-success/30",
    warning:
      "from-accent-warning/20 to-accent-warning/5 border-accent-warning/30",
    danger: "from-accent-danger/20 to-accent-danger/5 border-accent-danger/30",
    info: "from-accent-info/20 to-accent-info/5 border-accent-info/30",
  };

  const iconColors = {
    primary: "text-accent-primary",
    success: "text-accent-success",
    warning: "text-accent-warning",
    danger: "text-accent-danger",
    info: "text-accent-info",
  };

  const badgeColor = isActive
    ? "bg-accent-success text-white"
    : "bg-gray-700 text-gray-400";
  const badgeText = isActive ? "ACTIVE" : "INACTIVE";

  return (
    <div
      className={`glass-card-hover bg-gradient-to-br ${
        colorClasses[color]
      } p-5 border transition-all duration-300 hover:scale-105 ${
        isActive ? "hover:shadow-glow" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <span
              className={`text-xs font-bold px-2 py-1 rounded-full ${badgeColor} animate-fadeIn`}
            >
              {badgeText}
            </span>
          </div>
        </div>
        <div
          className={`p-2 rounded-lg bg-gradient-to-br ${
            colorClasses[color]
          } transition-transform duration-300 ${
            isActive ? "animate-pulse" : ""
          }`}
        >
          {Icon && <Icon className={`w-5 h-5 ${iconColors[color]}`} />}
        </div>
      </div>

      {/* RX and TX Stats */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* RX */}
        <div className="bg-black/30 rounded-lg p-3 border border-gray-700/30 transition-all duration-300 hover:border-gray-600/50">
          <p className="text-xs text-gray-400 mb-1">RX (Received)</p>
          <p className="text-2xl font-bold text-white">{rxCount}</p>
          <p className="text-xs text-gray-500 mt-1">messages</p>
        </div>

        {/* TX */}
        <div className="bg-black/30 rounded-lg p-3 border border-gray-700/30 transition-all duration-300 hover:border-gray-600/50">
          <p className="text-xs text-gray-400 mb-1">TX (Sent)</p>
          <p className="text-2xl font-bold text-white">{txCount}</p>
          <p className="text-xs text-gray-500 mt-1">messages</p>
        </div>
      </div>

      {/* Latency Display (if provided) */}
      {latency !== undefined && latency !== null && (
        <div className="bg-black/30 rounded-lg p-2 border border-gray-700/30">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Avg Latency</span>
            <span
              className={`text-sm font-semibold ${
                latency < 50
                  ? "text-accent-success"
                  : latency < 100
                  ? "text-accent-warning"
                  : "text-accent-danger"
              }`}
            >
              {latency}ms
            </span>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="mt-4 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r transition-all duration-500 ${
            color === "primary"
              ? "from-accent-primary to-accent-primary"
              : color === "success"
              ? "from-accent-success to-accent-success"
              : color === "danger"
              ? "from-accent-danger to-accent-danger"
              : color === "warning"
              ? "from-accent-warning to-accent-warning"
              : "from-accent-info to-accent-info"
          } ${isActive ? "animate-pulse" : ""}`}
          style={{
            width: isActive ? "100%" : "30%",
          }}
        />
      </div>
    </div>
  );
};

export default React.memo(CommStatsCard);
