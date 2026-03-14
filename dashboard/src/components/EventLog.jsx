import React, { useRef, useEffect } from "react";
import { ScrollText, Clock, Radio, Wifi } from "lucide-react";

/**
 * EventLog Component - Displays live event stream with type-based coloring and comm path info
 */
const EventLog = ({ events }) => {
  const logEndRef = useRef(null);

  useEffect(() => {
    // Auto-scroll to bottom when new events arrive
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour12: false });
  };

  // Get event styling based on type
  const getEventStyling = (event) => {
    const type = event.type || "normal";
    const color = event.color || "blue";

    const colorMap = {
      red: "border-l-4 border-accent-danger bg-accent-danger/5",
      green: "border-l-4 border-accent-success bg-accent-success/5",
      yellow: "border-l-4 border-accent-warning bg-accent-warning/5",
      blue: "border-l-4 border-accent-info bg-accent-info/5",
    };

    const typeStyleMap = {
      shutdown: {
        bg: "bg-accent-danger/10",
        badge: "bg-accent-danger/20 text-accent-danger",
        icon: "🔴",
      },
      election: {
        bg: "bg-accent-success/10",
        badge: "bg-accent-success/20 text-accent-success",
        icon: "⭐",
      },
      emergency: {
        bg: "bg-accent-warning/10",
        badge: "bg-accent-warning/20 text-accent-warning",
        icon: "⚠️",
      },
      restoration: {
        bg: "bg-accent-success/10",
        badge: "bg-accent-success/20 text-accent-success",
        icon: "✓",
      },
      normal: {
        bg: "bg-white/[0.02]",
        badge: "bg-accent-info/20 text-accent-info",
        icon: "📡",
      },
    };

    return {
      border: colorMap[color] || colorMap.blue,
      ...typeStyleMap[type],
    };
  };

  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-accent-success/20">
          <ScrollText className="w-5 h-5 text-accent-success" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Event Log</h2>
          <p className="text-sm text-gray-400">
            Real-time system events with communication paths
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {events && events.length > 0 ? (
          events.map((event, index) => {
            const styling = getEventStyling(event);
            return (
              <div
                key={event.id || index}
                className={`glass-card p-3 hover:bg-white/[0.08] transition-all ${styling.border}`}
              >
                <div className="flex items-start gap-3">
                  {/* Event Icon */}
                  <span className="text-lg flex-shrink-0">{styling.icon}</span>

                  {/* Event Content */}
                  <div className="flex-1 min-w-0">
                    {/* Event Type Badge */}
                    {event.type && event.type !== "normal" && (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${styling.badge} inline-block mb-1`}
                      >
                        {event.type.toUpperCase()}
                      </span>
                    )}

                    {/* Event Message */}
                    <p className="text-sm text-gray-200 break-words">
                      {event.message}
                    </p>

                    {/* Communication Path Info */}
                    {event.commPath && event.commPath.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {event.commPath.includes("mqtt") && (
                          <span className="text-xs px-2 py-0.5 bg-accent-info/20 text-accent-info rounded-full flex items-center gap-1 border border-accent-info/30">
                            <Radio className="w-3 h-3" />
                            MQTT
                          </span>
                        )}
                        {event.commPath.includes("espnow") && (
                          <span className="text-xs px-2 py-0.5 bg-accent-primary/20 text-accent-primary rounded-full flex items-center gap-1 border border-accent-primary/30">
                            <Wifi className="w-3 h-3" />
                            ESP-NOW
                          </span>
                        )}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-500">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No events yet</p>
            </div>
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(79, 70, 229, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 70, 229, 0.7);
        }
      `}</style>
    </div>
  );
};

export default React.memo(EventLog);
