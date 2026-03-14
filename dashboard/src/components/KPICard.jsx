import React from "react";

/**
 * KPI Card Component - Displays key metrics with icons and color coding
 */
const KPICard = ({
  title,
  value,
  icon: Icon,
  color,
  suffix = "",
  trend,
  subtitle,
  className = "",
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

  return (
    <div
      className={`glass-card-hover bg-gradient-to-br ${colorClasses[color]} p-6 transition-all duration-300 hover:scale-105 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400 mb-2">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-white">
              {value}
              <span className="text-lg ml-1 text-gray-400">{suffix}</span>
            </h3>
            {trend && (
              <span
                className={`text-sm ${
                  trend > 0 ? "text-accent-success" : "text-accent-danger"
                }`}
              >
                {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div
          className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}
        >
          {Icon && <Icon className={`w-6 h-6 ${iconColors[color]}`} />}
        </div>
      </div>
    </div>
  );
};

export default React.memo(KPICard);
