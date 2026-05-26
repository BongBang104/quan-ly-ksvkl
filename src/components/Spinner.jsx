import React from 'react';

export default function Spinner({ size = 24, color = '#2563eb' }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `3px solid ${color}33`,
        borderTop: `3px solid ${color}`,
        animation: 'spin 1s linear infinite',
      }}
    />
  );
}


