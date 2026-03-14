import React, { useState } from "react";
import {
  Sliders,
  Send,
  CheckCircle,
  XCircle,
  Power,
  RotateCcw,
} from "lucide-react";
import { sendControlCommand } from "../api";

/**
 * ControlPanel Component - Manual node control interface with shutdown/restore actions
 */
const ControlPanel = ({ nodes }) => {
  const [selectedNode, setSelectedNode] = useState("");
  const [selectedAction, setSelectedAction] = useState("RESTORE");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleSendCommand = async () => {
    if (!selectedNode) {
      setFeedback({ type: "error", message: "Please select a node" });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      await sendControlCommand(selectedNode, selectedAction);
      setFeedback({
        type: "success",
        message: `Command sent: ${selectedAction} → ${selectedNode}`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "Failed to send command",
      });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Find selected node data
  const currentNode = nodes?.find((n) => n.id === selectedNode);
  const isShutdown = currentNode?.shutdown === true;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-accent-warning/20">
          <Sliders className="w-5 h-5 text-accent-warning" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Manual Control</h2>
          <p className="text-sm text-gray-400">Send commands to nodes</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Node Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Node
          </label>
          <select
            value={selectedNode}
            onChange={(e) => {
              setSelectedNode(e.target.value);
              setFeedback(null); // Clear previous feedback
            }}
            className="w-full bg-dark-card border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
          >
            <option value="">-- Choose a node --</option>
            {/* Show connected nodes from grid data */}
            {nodes &&
              nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.id} -{" "}
                  {node.shutdown
                    ? "🔴 Shutdown"
                    : node.status === "OK"
                    ? "🟢 Active"
                    : "⚪ Offline"}
                </option>
              ))}
            {/* Manual entry options for nodes that might be offline */}
            <option disabled>──────────────</option>
            <option value="Node-1">📝 Node-1 (Manual)</option>
            <option value="Node-2">📝 Node-2 (Manual)</option>
            <option value="Node-3">📝 Node-3 (Manual)</option>
          </select>
        </div>

        {/* Node Status Display */}
        {currentNode && (
          <div
            className={`p-3 rounded-lg border ${
              isShutdown
                ? "bg-accent-danger/10 border-accent-danger/30"
                : currentNode.status === "OK"
                ? "bg-accent-success/10 border-accent-success/30"
                : "bg-accent-warning/10 border-accent-warning/30"
            }`}
          >
            <p className="text-xs text-gray-400 mb-1">Node Status</p>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isShutdown
                    ? "bg-accent-danger"
                    : currentNode.status === "OK"
                    ? "bg-accent-success"
                    : "bg-accent-warning"
                }`}
              ></div>
              <span
                className={`font-semibold ${
                  isShutdown
                    ? "text-accent-danger"
                    : currentNode.status === "OK"
                    ? "text-accent-success"
                    : "text-accent-warning"
                }`}
              >
                {isShutdown ? "Shutdown" : currentNode.status || "Unknown"}
              </span>
            </div>
          </div>
        )}

        {/* Primary Action - Shutdown/Restore */}
        {currentNode && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Control Action
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedAction("SHUTDOWN")}
                disabled={!selectedNode || isShutdown}
                className={`px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  selectedAction === "SHUTDOWN"
                    ? "bg-accent-danger text-white shadow-glow-sm"
                    : "bg-dark-card text-gray-400 border border-gray-700 hover:border-accent-danger disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                <Power className="w-4 h-4" />
                <span>Shutdown</span>
              </button>
              <button
                onClick={() => setSelectedAction("RESTORE")}
                disabled={!selectedNode || !isShutdown}
                className={`px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  selectedAction === "RESTORE"
                    ? "bg-accent-success text-white shadow-glow-sm"
                    : "bg-dark-card text-gray-400 border border-gray-700 hover:border-accent-success disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restore</span>
              </button>
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSendCommand}
          disabled={isLoading || !selectedNode}
          className="w-full bg-gradient-to-r from-accent-primary to-accent-info text-white font-semibold py-3 px-6 rounded-lg hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Sending...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send Command
            </>
          )}
        </button>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`p-4 rounded-lg flex items-center gap-3 ${
              feedback.type === "success"
                ? "bg-accent-success/20 border border-accent-success/30 text-accent-success"
                : "bg-accent-danger/20 border border-accent-danger/30 text-accent-danger"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;
