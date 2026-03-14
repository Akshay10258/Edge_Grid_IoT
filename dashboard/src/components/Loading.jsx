import React from 'react';

/**
 * Loading Component - Displayed while connecting or loading data
 */
const Loading = () => {
  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-8">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-accent-primary/20"></div>
          
          {/* Spinning ring */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-accent-primary animate-spin"></div>
          
          {/* Inner glow */}
          <div className="absolute inset-4 rounded-full bg-accent-primary/10 blur-md"></div>
        </div>
        
        <h2 className="text-2xl font-display font-bold text-gradient mb-2">
          EdgeGrid Hybrid
        </h2>
        <p className="text-gray-400">Initializing dashboard...</p>
      </div>
    </div>
  );
};

export default Loading;
