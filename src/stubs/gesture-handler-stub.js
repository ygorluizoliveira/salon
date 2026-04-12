import React from 'react';

function flattenStyle(style) {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flattenStyle));
  return style;
}

const Wrapper = ({ style, children }) =>
  React.createElement('div', { style: Object.assign({ display: 'flex', flexDirection: 'column', flex: 1 }, flattenStyle(style)) }, children);

export const GestureHandlerRootView = Wrapper;
export const Gesture = { Tap: () => ({}), Pan: () => ({}), Pinch: () => ({}) };
export const GestureDetector = ({ children }) => children;
export const State = {};
export const PanGestureHandler = Wrapper;
export const TapGestureHandler = Wrapper;
export const NativeViewGestureHandler = Wrapper;
export const ScrollView = Wrapper;
export const FlatList = Wrapper;

export default {};
