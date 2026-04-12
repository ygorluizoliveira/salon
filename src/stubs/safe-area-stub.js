import React from 'react';

function flattenStyle(style) {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flattenStyle));
  return style;
}

const divStyle = (extra) => Object.assign({ display: 'flex', flexDirection: 'column', flex: 1 }, flattenStyle(extra));

export const SafeAreaProvider = ({ children, style }) =>
  React.createElement('div', { style: divStyle(style) }, children);

export const SafeAreaView = ({ children, style }) =>
  React.createElement('div', { style: divStyle(style) }, children);

export const SafeAreaConsumer = ({ children }) =>
  children({ top: 0, right: 0, bottom: 0, left: 0 });

export const SafeAreaInsetsContext = React.createContext({ top: 0, right: 0, bottom: 0, left: 0 });

export const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 0, height: 0 });
export const initialWindowMetrics = null;

export default {};
