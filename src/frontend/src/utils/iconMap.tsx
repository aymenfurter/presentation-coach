// Icon mapping for presentation types
import {
  Money24Regular,
  Laptop24Regular,
  People24Regular,
} from '@fluentui/react-icons';
import React from 'react';

export const presentationIconMap: Record<string, React.ReactNode> = {
  Money: <Money24Regular />,
  Laptop: <Laptop24Regular />,
  People: <People24Regular />,
};

export function getPresentationIcon(iconName: string): React.ReactNode {
  return presentationIconMap[iconName] || <Money24Regular />;
}
