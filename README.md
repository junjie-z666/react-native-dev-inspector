# React Native Dev Inspector

> 🇨🇳 中文文档(本 fork 实测版本矩阵 + 接入指南 + 发布步骤): [packages/react-native-dev-inspector/README.md](./packages/react-native-dev-inspector/README.md)

Click on React Native components to jump directly to the source code in your IDE.

**[Documentation](https://vahesaroyan.github.io/react-native-dev-inspector/)** | [GitHub](https://github.com/VaheSaroyan/react-native-dev-inspector)

Inspired by [react-dev-inspector](https://github.com/zthxxx/react-dev-inspector) for web.

## Features

- **Click to Inspect** - Tap any component to see its source location
- **Open in Editor** - Jump directly to the component's source code in your IDE
- **Component Hierarchy** - Navigate the full component tree with breadcrumb UI
- **Box Model Visualization** - See margin, padding, and dimensions like browser DevTools
- **Style Inspector** - View computed styles of selected components
- **NativeWind Compatible** - Works seamlessly with Tailwind CSS for React Native
- **Dev Menu Integration** - Toggle inspector from React Native dev menu (shake or Cmd+D/Cmd+M)
- **Customizable** - Support for VS Code, Cursor, WebStorm, Sublime, and more
- **Expo & CLI Support** - Works with both Expo and React Native CLI projects
- **New Architecture Support** - Works with RN 0.68+, 0.73+, 0.82+ (Fabric)
- **Optional Babel Plugin** - Enhanced source tracking for more accurate "Open in Editor"

## Installation

```bash
npm install react-native-dev-inspector
```

## Quick Setup (2 steps)

### 1. Configure Metro

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
// or: const { getDefaultConfig } = require('@react-native/metro-config');

const { withInspector } = require('react-native-dev-inspector/metro');

const config = getDefaultConfig(__dirname);

module.exports = withInspector(config, {
  editor: 'code', // 'code' | 'cursor' | 'webstorm' | 'sublime' | etc.
});
```

### 2. Wrap Your App

```tsx
// App.tsx or _layout.tsx (Expo Router)
import { Inspector, InspectorDevMenu } from 'react-native-dev-inspector';

export default function App() {
  return (
    <Inspector>
      <YourApp />
      {/* Optional: floating button to toggle inspector */}
      <InspectorDevMenu position="bottom-right" />
    </Inspector>
  );
}
```

**That's it!** The inspector works out of the box.

## Version Compatibility (tested in this fork)

The `rn-compat` layer (metro resolver adapter + inspector hierarchy shim + runtime polyfills) makes the inspector work across RN versions. Tested matrix:

| RN version | Architecture | Status | Notes |
|-----------|--------------|--------|-------|
| 0.72 | Paper | ✅ Tested | Wrapper components (Button/Touchable) resolve to the business JSX line via `touchedViewTag` fiber lookup; `URLSearchParams` polyfilled for Open-in-editor |
| 0.73 – 0.81 | Fabric | ✅ Tested (0.81.6, bridgeless) | Hierarchy fibers restored; `scriptURL` read from TurboModule `getConstants()` so Open works on any Metro port |
| 0.82+ | Fabric | ✅ Tested (0.86) | New private inspector path intercepted; hierarchy rebuilt through the shim |

### Integration per version

**All versions** — 3 steps: Metro plugin, babel plugin, wrap the app. Always gate the runtime parts with `__DEV__` so release builds strip them entirely:

```tsx
// App.tsx
import React from 'react';
import {Inspector, InspectorDevMenu} from 'react-native-dev-inspector';

export default function App() {
  const app = <YourApp />;
  if (!__DEV__) {
    // Release build: no inspector code in the bundle at all
    return app;
  }
  return (
    <Inspector>
      {app}
      <InspectorDevMenu position="bottom-right" />
    </Inspector>
  );
}
```

**RN ≤ 0.72 (Paper)** — additionally apply `withInspectorCompat` in Metro so the hierarchy shim and dependency fixes kick in:

```js
// metro.config.js
const {getDefaultConfig} = require('@react-native/metro-config');
const {withInspector} = require('react-native-dev-inspector/metro');
const {withInspectorCompat} = require('react-native-dev-inspector/rn-compat');

module.exports = withInspector(
  withInspectorCompat(getDefaultConfig(__dirname)),
  {editor: 'code'},
);
```

**RN 0.73 – 0.81 (Fabric)** — same Metro setup as above (`withInspectorCompat` fixes the optional-dependency resolution and restores hierarchy fibers); Open-in-editor works on any Metro port out of the box:

```js
// metro.config.js — identical wrapper order, e.g. with Expo:
const {getDefaultConfig} = require('expo/metro-config');
const {withInspector} = require('react-native-dev-inspector/metro');
const {withInspectorCompat} = require('react-native-dev-inspector/rn-compat');

module.exports = withInspector(
  withInspectorCompat(getDefaultConfig(__dirname)),
  {editor: 'code'},
);
```

**RN 0.82+ (Fabric, new private path)** — same as 0.73–0.81; the resolver intercepts the new private inspector path and rebuilds the hierarchy through the shim:

```js
// metro.config.js — no extra flags, same two wrappers:
module.exports = withInspector(
  withInspectorCompat(getDefaultConfig(__dirname)),
  {editor: 'code'},
);
```

The runtime polyfills (e.g. `URLSearchParams.set` on RN 0.72) are imported automatically by the umbrella package and are feature-detected — they are no-ops on newer RN and are stripped from release bundles together with the `__DEV__` gate.

## Enhanced Source Tracking (Optional Babel Plugin)

For more accurate "Open in Editor" functionality, you can optionally add the babel plugin. This injects source location information directly into your JSX components, providing precise file and line tracking.

```js
// babel.config.js
const { inspectorBabelPlugin } = require('react-native-dev-inspector/metro');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'], // or your existing presets
    plugins: [
      inspectorBabelPlugin,
      // ... your other plugins
    ],
  };
};
```

The babel plugin:
- Injects `__callerSource` prop into JSX elements with file, line, and column info
- Only processes user code (skips `node_modules`)
- Works with both native and custom components

## NativeWind Integration

The inspector works seamlessly with NativeWind (Tailwind CSS for React Native). See the [nativewind-usage example](./examples/nativewind-usage) for a complete setup.

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { withInspector } = require('@azsxdc12356/react-native-dev-inspector/metro');

const config = getDefaultConfig(__dirname);

// Apply NativeWind first, then Inspector
const nativeWindConfig = withNativeWind(config, { input: './global.css' });
module.exports = withInspector(nativeWindConfig);
```

```js
// babel.config.js - with NativeWind
const { inspectorBabelPlugin } = require('@azsxdc12356/react-native-dev-inspector/metro');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      inspectorBabelPlugin,
      'react-native-reanimated/plugin', // Must be last
    ],
  };
};
```

## Usage

### Toggle Inspector

There are multiple ways to toggle the inspector:

1. **Dev Menu** - Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android), then select "Toggle Dev Inspector"
2. **Floating Button** - Use `<InspectorDevMenu />` component
3. **Programmatically** - Use the `useInspector` hook or `toggleInspectorGlobal()`

```tsx
import { useInspector, toggleInspectorGlobal } from 'react-native-dev-inspector';

// Using hook (inside Inspector)
function MyComponent() {
  const { toggleInspector, isInspecting } = useInspector();

  return (
    <Button
      title={isInspecting ? 'Stop Inspecting' : 'Inspect'}
      onPress={toggleInspector}
    />
  );
}

// Global toggle (anywhere in your app)
toggleInspectorGlobal();
```

### Inspect Components

1. Enable the inspector
2. A "Tap to inspect" hint appears
3. Tap on any component
4. See the component hierarchy, styles, and box model
5. Tap "Open" to jump to the source file in your editor

## API Reference

### `<Inspector>` Component

Main wrapper component that enables inspection.

```tsx
<Inspector
  disabled={false}                    // Disable inspector entirely
  editor="code"                       // Editor command
  devServerUrl="http://localhost:8081" // Custom dev server URL
  addToDevMenu={true}                 // Add toggle to RN dev menu
  onInspectorEnabled={() => {}}       // Callback when enabled
  onInspectorDisabled={() => {}}      // Callback when disabled
  onElementSelected={(info) => {}}    // Callback when element selected
  onElementTapped={(info) => {}}      // Callback before opening editor
>
  {children}
</Inspector>
```

### `<InspectorDevMenu>` Component

Floating button for toggling inspector.

```tsx
<InspectorDevMenu
  position="bottom-right"      // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  compact={true}               // Use smaller 32x32 button (vs 50x50)
  showOnlyWhenInactive={true}  // Hide when inspector is active
  containerStyle={{}}          // Custom container styles
/>
```

### `<InspectorButton>` Component

Inline button for custom UI integration.

```tsx
<InspectorButton
  label="Inspect"
  activeLabel="Stop Inspecting"
  style={{}}
  textStyle={{}}
/>

{/* Or with render function for complete control */}
<InspectorButton>
  {(isInspecting, toggle) => (
    <YourCustomButton onPress={toggle} active={isInspecting} />
  )}
</InspectorButton>
```

### `useInspector()` Hook

Access inspector state and controls.

```tsx
const {
  isInspecting,     // boolean - current state
  enableInspector,  // () => void - enable inspector
  disableInspector, // () => void - disable inspector
  toggleInspector,  // () => void - toggle state
} = useInspector();
```

## Supported Editors

| Editor | Command |
|--------|---------|
| VS Code | `code` |
| VS Code Insiders | `code-insiders` |
| Cursor | `cursor` |
| WebStorm | `webstorm` |
| IntelliJ IDEA | `idea` |
| PhpStorm | `phpstorm` |
| Sublime Text | `subl` |
| Atom | `atom` |
| Vim | `vim` |
| Neovim | `nvim` |
| Emacs | `emacs` |
| Zed | `zed` |
| Android Studio | `studio` |
| Xcode | `xed` |

Set the editor via:
- Metro plugin option: `withInspector(config, { editor: 'cursor' })`
- Environment variable: `REACT_EDITOR=cursor`

## How It Works

The inspector works without any build-time transformations:

1. **Runtime (Inspector Component)**: Uses React Native's internal `getInspectorDataForViewAtPoint` API to:
   - Capture touch events and find the tapped element
   - Traverse the React fiber tree to build the component hierarchy
   - Extract source locations from React's debug info (`_debugSource`)
   - Display the inspector panel with hierarchy, styles, and box model

2. **Dev Server (Metro Plugin)**: Provides an endpoint for opening files:
   - `/__inspect-open-in-editor?file=...&line=...&column=...`
   - Uses `launch-editor` for cross-platform editor detection and launching

## Architecture

```
+------------------------------------------------------------------+
|                      Your React Native App                        |
|  +------------------------------------------------------------+  |
|  |                      <Inspector>                            |  |
|  |  +------------------------------------------------------+  |  |
|  |  |                  Your Components                      |  |  |
|  |  |  <CustomButton />                                    |  |  |
|  |  |    <View>                                            |  |  |
|  |  |      <Text>Click me</Text>                           |  |  |
|  |  +------------------------------------------------------+  |  |
|  |  +------------------------------------------------------+  |  |
|  |  |  Inspector Panel: hierarchy | styles | box model      |  |  |
|  |  +------------------------------------------------------+  |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
                              |
                              | fetch("/__inspect-open-in-editor?file=...&line=...")
                              v
+------------------------------------------------------------------+
|                       Metro Dev Server                            |
|  +------------------------------------------------------------+  |
|  |    react-native-dev-inspector/metro (withInspector)        |  |
|  |  Endpoint: /__inspect-open-in-editor                        |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
                              |
                              | launch-editor (auto-detects running editor)
                              v
+------------------------------------------------------------------+
|                        Your IDE/Editor                            |
|                     (opens file:line:column)                      |
+------------------------------------------------------------------+
```

## Troubleshooting

### Editor doesn't open

1. Make sure the editor command is in your PATH
2. Set `REACT_EDITOR` environment variable: `export REACT_EDITOR=code`
3. Check the Metro console for error messages

### Inspector doesn't show source location

1. Make sure you're running in development mode (`__DEV__` is true)
2. Clear the Metro bundler cache: `npx expo start --clear` or `npx react-native start --reset-cache`
3. Some library components may not have source info available

### Inspector doesn't show up

1. Make sure you're running in development mode (`__DEV__` is true)
2. Wrap your app with `<Inspector>` component
3. Check that the component isn't disabled

## License

MIT

## Credits

Inspired by [react-dev-inspector](https://github.com/zthxxx/react-dev-inspector) by [@zthxxx](https://github.com/zthxxx).
