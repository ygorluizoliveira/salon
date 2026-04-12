import React from 'react';

// Flatten React Native style arrays into a plain object
function flattenStyle(style) {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flattenStyle));
  return style;
}

// Props that are React Native-specific and must not reach the DOM
const RN_PROPS = new Set([
  'activityState', 'freezeOnBlur', 'shouldFreeze', 'enabled', 'hasTwoStates',
  'stackPresentation', 'stackAnimation', 'replaceAnimation',
  'gestureEnabled', 'gestureResponseDistance', 'gestureVelocityImpact',
  'onDismissed', 'onAppear', 'onDisappear', 'onHeaderBackButtonClicked',
  'onNativeDismissCancelled', 'onGestureCancel', 'onSheetDetentChanged',
  'onLayout', 'onAccessibilityAction', 'onAccessibilityEscape',
  'sheetAllowedDetents', 'sheetLargestUndimmedDetent', 'sheetGrabberVisible',
  'sheetCornerRadius', 'sheetExpandsWhenScrolledToEdge', 'statusBarAnimation',
  'statusBarColor', 'statusBarHidden', 'statusBarStyle', 'statusBarTranslucent',
  'navigationBarColor', 'navigationBarHidden', 'screenOrientation',
  'preventNativeDismiss', 'customAnimationOnSwipe', 'fullScreenSwipeEnabled',
  'homeIndicatorHidden', 'hideKeyboardOnSwipe', 'isNativeStack',
  'hasLargeHeader', 'contentStyle',
]);

function View({ style, children, pointerEvents, ...props }) {
  const filteredProps = {};
  for (const key of Object.keys(props)) {
    if (!RN_PROPS.has(key)) filteredProps[key] = props[key];
  }
  const flatStyle = Object.assign(
    { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
    flattenStyle(style),
    pointerEvents ? { pointerEvents } : {},
  );
  return React.createElement('div', { style: flatStyle, ...filteredProps }, children);
}

export const enableScreens = () => {};
export const enableFreeze = () => {};
export const screensEnabled = () => true;
export const freezeEnabled = () => false;

export const Screen = View;
export const InnerScreen = View;
export const ScreenContext = React.createContext(null);
export const ScreenContainer = View;
export const ScreenStack = View;
export const ScreenStackItem = View;
export const FullWindowOverlay = View;
export const ScreenFooter = View;
export const ScreenContentWrapper = View;
export const SearchBar = View;

export const ScreenStackHeaderConfig = () => null;
export const ScreenStackHeaderSubview = () => null;
export const ScreenStackHeaderLeftView = () => null;
export const ScreenStackHeaderCenterView = () => null;
export const ScreenStackHeaderRightView = () => null;
export const ScreenStackHeaderBackButtonImage = () => null;
export const ScreenStackHeaderSearchBarView = () => null;

export const isSearchBarAvailableForCurrentPlatform = false;
export const executeNativeBackPress = () => {};

export default {};
