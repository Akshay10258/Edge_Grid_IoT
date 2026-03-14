import React from 'react';

/**
 * TopBar Component - Displays project name and current leader info
 */
const TopBar = ({ leaderNode, isConnected }) => {
  return (
    <div className="glass-card p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient">
            EdgeGrid Hybrid Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            ESP32-based Distributed Mini Smart-Grid System
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent-success animate-pulse' : 'bg-accent-danger'}`}></div>
            <span className="text-sm text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {/* Leader Badge */}
          {leaderNode && (
            <div className="glass-card bg-gradient-to-r from-accent-primary/20 to-accent-info/20 border-accent-primary/40 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-lg">★</span>
                <div>
                  <p className="text-xs text-gray-400">Current Leader</p>
                  <p className="text-sm font-semibold text-white">{leaderNode}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
