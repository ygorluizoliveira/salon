import React from 'react';

function flattenStyle(style) {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flattenStyle));
  if (typeof style === 'object') return style;
  return {};
}

export const MotiView = ({ from, animate, exit, transition, style, children, ...props }) =>
  React.createElement('div', { style: Object.assign({ display: 'flex', flexDirection: 'column' }, flattenStyle(style)), ...props }, children);

export const MotiText = ({ from, animate, exit, transition, style, children, ...props }) =>
  React.createElement('span', { style: flattenStyle(style), ...props }, children);

export const MotiImage = ({ from, animate, exit, transition, style, ...props }) =>
  React.createElement('img', { style: flattenStyle(style), ...props });

export const AnimatePresence = ({ children }) => children;

export const useAnimationState = (states) => ({
  current: Object.keys(states)[0],
  transitionTo: () => {},
});

export const useDynamicAnimation = () => ({
  animateTo: () => {},
});

export const motify = (Component) => Component;

export default {};
