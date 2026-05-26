import React from 'react';

const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    zIndex: 9999,
  },
  container: {
    width: '100%',
    maxWidth: '980px',
    maxHeight: '90vh',
    overflowY: 'auto',
    backgroundColor: '#fff',
    borderRadius: '20px',
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
    border: '1px solid #e2e8f0',
  },
};

export default function Modal({ visible, children, maxWidth, zIndex }) {
  if (!visible) return null;

  return (
    <div style={{ ...modalStyles.overlay, ...(zIndex ? { zIndex } : {}) }}>
      <div style={{ ...modalStyles.container, maxWidth: maxWidth || '980px' }}>{children}</div>
    </div>
  );
}


