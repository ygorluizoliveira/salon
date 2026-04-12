/**
 * react-native-shim.js
 *
 * Drop-in replacement for the `react-native` module when running in a browser.
 *
 * Why this file exists
 * ────────────────────
 * `react-native-web` v0.21 passes all component props through an internal
 * `pickProps()` whitelist that silently drops `className`. That means every
 * Tailwind class used in the pages would be ignored.
 *
 * This shim re-exports everything from `react-native-web` as a base and then
 * overrides the most-used components (View, Text, ScrollView, etc.) with thin
 * wrappers that render as plain HTML elements, so `className` — and therefore
 * Tailwind — works correctly.
 *
 * How to add a new component
 * ──────────────────────────
 * 1. Create a `React.forwardRef` wrapper that renders the appropriate HTML tag.
 * 2. Destructure and discard known RN-only props by hand (or add them to
 *    RN_SKIP_PROPS so `domSafeProps()` strips them automatically).
 * 3. Export it below the "Core components" section.
 */
export * from 'react-native-web';
import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively merges a React Native style value (object, array, or falsy) into
 * a plain style object safe to pass to a DOM element.
 */

function flattenStyle(style) {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean).map(flattenStyle));
  if (typeof style === 'object') {
    const s = { ...style };
    // Convert React Native shorthand props that CSS doesn't understand
    if (s.paddingHorizontal != null) {
      if (s.paddingLeft  == null) s.paddingLeft  = s.paddingHorizontal;
      if (s.paddingRight == null) s.paddingRight = s.paddingHorizontal;
      delete s.paddingHorizontal;
    }
    if (s.paddingVertical != null) {
      if (s.paddingTop    == null) s.paddingTop    = s.paddingVertical;
      if (s.paddingBottom == null) s.paddingBottom = s.paddingVertical;
      delete s.paddingVertical;
    }
    if (s.marginHorizontal != null) {
      if (s.marginLeft  == null) s.marginLeft  = s.marginHorizontal;
      if (s.marginRight == null) s.marginRight = s.marginHorizontal;
      delete s.marginHorizontal;
    }
    if (s.marginVertical != null) {
      if (s.marginTop    == null) s.marginTop    = s.marginVertical;
      if (s.marginBottom == null) s.marginBottom = s.marginVertical;
      delete s.marginVertical;
    }
    return s;
  }
  return {};
}

/**
 * Props that are React Native-only and must NOT be forwarded to the DOM.
 * Organized by category for easy maintenance.
 *
 * To add support for a new prop that triggers a React DOM warning:
 *   1. Find the category it belongs to below.
 *   2. Add the prop name to that group.
 */
const RN_SKIP_PROPS = new Set([
  // ── Scroll & scroll gestures ────────────────────────────────────────────
  'onContentSizeChange',
  'onMomentumScrollBegin', 'onMomentumScrollEnd',
  'onScrollBeginDrag', 'onScrollEndDrag',
  'showsHorizontalScrollIndicator', 'showsVerticalScrollIndicator',
  'scrollEnabled', 'pagingEnabled', 'bounces',
  'keyboardDismissMode', 'keyboardShouldPersistTaps',

  // ── Layout & measurement ─────────────────────────────────────────────────
  'onLayout',
  'collapsable', 'removeClippedSubviews', 'needsOffscreenAlphaCompositing',
  'pointerEvents',

  // ── Responder / gesture system ───────────────────────────────────────────
  'onMoveShouldSetResponder', 'onStartShouldSetResponder',
  'onResponderGrant', 'onResponderMove', 'onResponderRelease',
  'onResponderTerminate', 'onResponderTerminationRequest',
  'onScrollShouldSetResponder',

  // ── Touchable / Pressable ────────────────────────────────────────────────
  'activeOpacity', 'underlayColor',
  'delayLongPress', 'delayPressIn', 'delayPressOut',
  'hitSlop', 'pressRetentionOffset',
  'onLongPress', 'onPressIn', 'onPressOut',

  // ── TextInput ────────────────────────────────────────────────────────────
  'placeholderTextColor', 'selectionColor', 'cursorColor',
  'autoCorrect', 'autoCapitalize', 'spellCheck',
  'returnKeyType', 'blurOnSubmit', 'enablesReturnKeyAutomatically',
  'textAlignVertical', 'textBreakStrategy',

  // ── Text ─────────────────────────────────────────────────────────────────
  'allowFontScaling', 'adjustsFontSizeToFit', 'minimumFontScale',
  'suppressHighlighting', 'selectable', 'dataDetectorTypes',

  // ── Accessibility (RN-specific; use aria-* equivalents for DOM) ──────────
  'accessible', 'accessibilityLabel', 'accessibilityHint',
  'accessibilityRole', 'accessibilityState', 'accessibilityValue',
  'importantForAccessibility',

  // ── React Navigation internal ────────────────────────────────────────────
  'hasTwoStates', 'activityState', 'freezeOnBlur', 'shouldFreeze',
]);

/**
 * DOM event handler names that are safe to forward.
 * All other `on*` props (RN gesture handlers, etc.) are blocked by domSafeProps().
 */
const DOM_EVENTS = new Set([
  'onClick', 'onDoubleClick', 'onMouseDown', 'onMouseEnter', 'onMouseLeave',
  'onMouseMove', 'onMouseOver', 'onMouseOut', 'onMouseUp', 'onKeyDown', 'onKeyUp',
  'onScroll', 'onWheel', 'onFocus', 'onBlur', 'onChange', 'onInput', 'onSubmit',
  'onContextMenu', 'onTouchStart', 'onTouchMove', 'onTouchEnd',
]);

/**
 * Strips props that are valid in React Native but invalid on DOM elements.
 * Blocks any unknown `on*` handler that isn't in DOM_EVENTS to prevent
 * React's "Unknown event handler property" warning.
 */
function domSafeProps(props) {
  const out = {};
  for (const k of Object.keys(props)) {
    if (RN_SKIP_PROPS.has(k)) continue;
    if (k.startsWith('on') && !DOM_EVENTS.has(k)) continue;
    out[k] = props[k];
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core components — override react-native-web to support className + Tailwind
// ─────────────────────────────────────────────────────────────────────────────

export const View = React.forwardRef(({ className, style, children, ...rest }, ref) => {
  // 'rn-view' provides the default flex-direction:column via CSS (@layer base),
  // allowing Tailwind utility classes like flex-row to override it normally.
  const s = Object.assign({ display: 'flex' }, flattenStyle(style));
  const cls = ['rn-view', className].filter(Boolean).join(' ');
  return React.createElement('div', { ...domSafeProps(rest), className: cls, style: s, ref }, children);
});
View.displayName = 'View';

export const Text = React.forwardRef(({ className, style, children, numberOfLines, ...rest }, ref) => {
  const s = Object.assign({}, flattenStyle(style));
  if (numberOfLines === 1) Object.assign(s, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  return React.createElement('span', { ...domSafeProps(rest), className, style: s, ref }, children);
});
Text.displayName = 'Text';

export const ScrollView = React.forwardRef(({
  className, style, children, horizontal, contentContainerStyle, ...rest
}, ref) => {
  const containerStyle = Object.assign(
    { display: 'flex', flexDirection: horizontal ? 'row' : 'column', overflow: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 },
    flattenStyle(style)
  );
  const contentStyle = Object.assign(
    { display: 'flex', flexDirection: horizontal ? 'row' : 'column' },
    flattenStyle(contentContainerStyle)
  );
  return React.createElement('div', { ...domSafeProps(rest), className, style: containerStyle, ref },
    React.createElement('div', { style: contentStyle }, children)
  );
});
ScrollView.displayName = 'ScrollView';

export const TouchableOpacity = React.forwardRef(({
  className, style, children, onPress, disabled, activeOpacity = 0.7, ...rest
}, ref) => {
  const s = Object.assign({ cursor: disabled ? 'default' : 'pointer', display: 'flex', outline: 'none' }, flattenStyle(style));
  const cls = ['rn-view', className].filter(Boolean).join(' ');
  return React.createElement('div', {
    ...domSafeProps(rest), className: cls, style: s, ref,
    onClick: disabled ? undefined : onPress,
    role: 'button',
    tabIndex: disabled ? -1 : 0,
    onKeyDown: (e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) onPress?.(e); },
  }, children);
});
TouchableOpacity.displayName = 'TouchableOpacity';

export const TouchableHighlight = TouchableOpacity;

export const Pressable = React.forwardRef(({ className, style, children, onPress, disabled, ...rest }, ref) => {
  const styleVal = typeof style === 'function' ? style({ pressed: false }) : style;
  const s = Object.assign({ cursor: disabled ? 'default' : 'pointer', display: 'flex' }, flattenStyle(styleVal));
  const cls = ['rn-view', className].filter(Boolean).join(' ');
  return React.createElement('div', {
    ...domSafeProps(rest), className: cls, style: s, ref,
    onClick: disabled ? undefined : onPress,
    role: 'button',
    tabIndex: disabled ? -1 : 0,
  }, children);
});
Pressable.displayName = 'Pressable';

export const Image = React.forwardRef(({ className, style, source, resizeMode, ...rest }, ref) => {
  const s = Object.assign({}, flattenStyle(style));
  if (resizeMode) s.objectFit = resizeMode === 'cover' ? 'cover' : resizeMode === 'contain' ? 'contain' : resizeMode;
  const src = source ? (typeof source === 'object' ? source.uri : source) : undefined;
  return React.createElement('img', { ...domSafeProps(rest), className, style: s, src, ref });
});
Image.displayName = 'Image';

export const TextInput = React.forwardRef(({
  className, style, value, defaultValue, onChangeText, onChange, placeholder,
  secureTextEntry, multiline, numberOfLines, editable = true, keyboardType, ...rest
}, ref) => {
  const s = Object.assign({ outline: 'none', border: 'none', background: 'transparent', width: '100%' }, flattenStyle(style));
  const handleChange = (e) => {
    onChangeText?.(e.target.value);
    onChange?.(e);
  };
  if (multiline) {
    return React.createElement('textarea', {
      ...domSafeProps(rest), className, style: s, ref,
      value, defaultValue, placeholder,
      disabled: !editable,
      rows: numberOfLines || 4,
      onChange: handleChange,
    });
  }
  return React.createElement('input', {
    ...domSafeProps(rest), className, style: s, ref,
    value, defaultValue, placeholder,
    type: secureTextEntry ? 'password' : keyboardType === 'email-address' ? 'email' : keyboardType === 'numeric' ? 'number' : 'text',
    disabled: !editable,
    onChange: handleChange,
  });
});
TextInput.displayName = 'TextInput';

export const FlatList = React.forwardRef(({
  className, style, data, renderItem, keyExtractor, horizontal,
  ListHeaderComponent, ListFooterComponent, ListEmptyComponent,
  contentContainerStyle, ...rest
}, ref) => {
  const containerStyle = Object.assign(
    { display: 'flex', flexDirection: horizontal ? 'row' : 'column', overflow: 'auto' },
    flattenStyle(style)
  );
  const contentStyle = Object.assign(
    { display: 'flex', flexDirection: horizontal ? 'row' : 'column' },
    flattenStyle(contentContainerStyle)
  );
  const items = data?.map((item, index) => {
    const key = keyExtractor ? keyExtractor(item, index) : String(index);
    return React.createElement(React.Fragment, { key }, renderItem({ item, index }));
  }) ?? [];
  return React.createElement('div', { ...domSafeProps(rest), className, style: containerStyle, ref },
    React.createElement('div', { style: contentStyle },
      ListHeaderComponent ? (typeof ListHeaderComponent === 'function' ? React.createElement(ListHeaderComponent) : ListHeaderComponent) : null,
      items.length === 0 && ListEmptyComponent
        ? (typeof ListEmptyComponent === 'function' ? React.createElement(ListEmptyComponent) : ListEmptyComponent)
        : items,
      ListFooterComponent ? (typeof ListFooterComponent === 'function' ? React.createElement(ListFooterComponent) : ListFooterComponent) : null
    )
  );
});
FlatList.displayName = 'FlatList';

export const Modal = ({ visible, children, onRequestClose, transparent }) => {
  if (!visible) return null;
  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: transparent ? 'transparent' : 'rgba(0,0,0,0.5)',
  };
  return React.createElement('div', { style: overlayStyle, onClick: onRequestClose },
    React.createElement('div', { onClick: (e) => e.stopPropagation() }, children)
  );
};
Modal.displayName = 'Modal';

// ─────────────────────────────────────────────────────────────────────────────
// Stubs for New Architecture / native-only APIs not available in react-native-web
// ─────────────────────────────────────────────────────────────────────────────

export const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: () => ({}),
};

export function codegenNativeComponent() { return null; }
export function codegenNativeCommands() { return {}; }

export const NativeAnimatedHelper = {};
export const AccessibilityInfo = {
  addEventListener: () => ({ remove: () => {} }),
  announceForAccessibility: () => {},
};
