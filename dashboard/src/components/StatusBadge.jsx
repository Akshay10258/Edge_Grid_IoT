import React from 'react';

/**
 * StatusBadge Component - Colored status indicator
 */
const StatusBadge = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-2 text-sm'
  };

  const statusConfig = {
    OK: {
      bg: 'bg-accent-success/20',
      text: 'text-accent-success',
      border: 'border-accent-success/30',
      icon: '✓'
    },
    SHED: {
      bg: 'bg-accent-warning/20',
      text: 'text-accent-warning',
      border: 'border-accent-warning/30',
      icon: '⚠'
    },
    STALE: {
      bg: 'bg-accent-danger/20',
      text: 'text-accent-danger',
      border: 'border-accent-danger/30',
      icon: '✗'
    },
    OVERLOAD: {
      bg: 'bg-accent-danger/20',
      text: 'text-accent-danger',
      border: 'border-accent-danger/30',
      icon: '⚡'
    },
    WARNING: {
      bg: 'bg-accent-warning/20',
      text: 'text-accent-warning',
      border: 'border-accent-warning/30',
      icon: '⚠'
    },
    OFFLINE: {
      bg: 'bg-gray-500/20',
      text: 'text-gray-400',
      border: 'border-gray-500/30',
      icon: '○'
    }
  };

  const config = statusConfig[status?.toUpperCase()] || statusConfig.OFFLINE;

  return (
    <span className={`
      inline-flex items-center gap-1.5 
      ${sizeClasses[size]} 
      ${config.bg} 
      ${config.text} 
      ${config.border} 
      border rounded-full font-semibold
      transition-all duration-200
    `}>
      <span className="text-sm">{config.icon}</span>
      {status}
    </span>
  );
};

export default StatusBadge;
