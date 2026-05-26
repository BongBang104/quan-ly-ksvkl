import React from 'react';
import * as LucideIcons from 'lucide-react';

const normalizeIconName = (name = '') => {
  return name
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};

export default function Icon({ name, size = 18, color = '#000', style = {}, ...props }) {
  const iconName = normalizeIconName(name);
  const IconComponent = LucideIcons[iconName] || LucideIcons.Circle;
  return <IconComponent size={size} color={color} style={style} {...props} />;
}


