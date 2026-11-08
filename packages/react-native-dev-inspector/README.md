# React Native Dev Inspector(中文文档)

> 本项目 fork 自 [VaheSaroyan/react-native-dev-inspector](https://github.com/VaheSaroyan/react-native-dev-inspector)(原仓库),在其基础上做了跨 RN 版本兼容等改造。本 npm 包为 fork 的发布版,感谢原作者。

点击 RN 组件,直接在 IDE 中跳转到对应源码。

> 本文档只覆盖**本 fork 实测过的内容**与**接入步骤**。英文文档见原仓库 [README](https://github.com/VaheSaroyan/react-native-dev-inspector#readme)。

## 安装

```bash
npm install @azsxdc12356/react-native-dev-inspector
# 或
pnpm add @azsxdc12356/react-native-dev-inspector
```

本包为单包发布(`core` / `metro-plugin` / `rn-compat` 已打包进 dist),无需额外安装子包。仅开发调试用,请始终配合 `__DEV__` 使用(见下文),release 构建不会包含任何 inspector 代码。

## 已测版本矩阵(本 fork)

`rn-compat` 层(Metro resolver 适配 + inspector hierarchy shim + 运行时 polyfill)让本工具跨 RN 版本工作。实测矩阵:

| RN 版本 | 架构 | 状态 | 备注 |
|---------|------|------|------|
| 0.72 | Paper | ✅ 已测 | 包裹组件(Button/Touchable)通过 `touchedViewTag` fiber 查找解析到业务 JSX 行;为 Open-in-editor 补了 `URLSearchParams` polyfill |
| 0.73 – 0.81 | Fabric | ✅ 已测(0.81.6,bridgeless) | 恢复层级 fiber;`scriptURL` 从 TurboModule `getConstants()` 读取,任意 Metro 端口下 Open 均可用 |
| 0.82+ | Fabric | ✅ 已测(0.86) | 拦截新的私有 inspector 路径;层级经 shim 重建 |

## 接入步骤(所有版本通用,共 3 步)

### 1. 配置 Metro

```js
// metro.config.js
const {getDefaultConfig} = require('@react-native/metro-config');
// Expo 项目用: const {getDefaultConfig} = require('expo/metro-config');

const {withInspector} = require('@azsxdc12356/react-native-dev-inspector/metro');
const {withInspectorCompat} = require('@azsxdc12356/react-native-dev-inspector/rn-compat');

module.exports = withInspector(
  withInspectorCompat(getDefaultConfig(__dirname)),
  {editor: 'code'}, // 'code' | 'cursor' | 'webstorm' | 'sublime' 等
);
```

两个 wrapper 的嵌套顺序固定:`withInspector(withInspectorCompat(config))`。RN 0.72(Paper)依赖 `withInspectorCompat` 启用层级 shim 和依赖修复;0.73–0.81 靠它修复 optional-dependency 解析并恢复层级 fiber;0.82+ 靠它拦截新的私有 inspector 路径。

### 2. 配置 Babel 插件(增强 Open-in-Editor 定位精度)

```js
// babel.config.js
const {inspectorBabelPlugin} = require('@azsxdc12356/react-native-dev-inspector/metro');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'], // 或你项目现有的 presets
    plugins: [
      inspectorBabelPlugin,
      // ...其他插件(reanimated/plugin 必须放最后)
    ],
  };
};
```

插件行为:

- 向 JSX 元素注入 `__callerSource` prop(文件、行、列信息),让"Open in Editor"精确到业务代码行
- 只处理业务代码(自动跳过 `node_modules`)
- 原生组件与自定义组件均支持

### 3. 包裹 App(用 `__DEV__` 门控)

```tsx
// App.tsx(Expo Router 用 _layout.tsx)
import React from 'react';
import {Inspector, InspectorDevMenu} from '@azsxdc12356/react-native-dev-inspector';

export default function App() {
  const app = <YourApp />;
  if (!__DEV__) {
    // Release 构建:bundle 中完全不包含 inspector 代码
    return app;
  }
  return (
    <Inspector>
      {app}
      {/* 可选:悬浮按钮切换 inspector */}
      <InspectorDevMenu position="bottom-right" />
    </Inspector>
  );
}
```

运行时 polyfill(如 RN 0.72 的 `URLSearchParams.set`)由包内部自动按需加载、带特性检测——在新版本 RN 上是空操作,并随 `__DEV__` 门控一起被 release 构建剔除。

完成。开启 inspector 的方式:摇一摇 / `Cmd+D`(iOS)/ `Cmd+M`(Android)打开 Dev Menu 选 "Toggle Dev Inspector",或点悬浮按钮;选中组件后可见组件层级、样式、盒模型,点 "Open" 跳转编辑器。

## NativeWind 接入(已实测)

与 NativeWind(Tailwind CSS for RN)兼容。Metro 中先应用 NativeWind 再应用 Inspector:

```js
// metro.config.js
const {getDefaultConfig} = require('expo/metro-config');
const {withNativeWind} = require('nativewind/metro');
const {withInspector} = require('@azsxdc12356/react-native-dev-inspector/metro');
const {withInspectorCompat} = require('@azsxdc12356/react-native-dev-inspector/rn-compat');

const config = getDefaultConfig(__dirname);

const nativeWindConfig = withNativeWind(config, {input: './global.css'});
module.exports = withInspector(
  withInspectorCompat(nativeWindConfig),
  {editor: 'code'},
);
```

```js
// babel.config.js - NativeWind 项目
const {inspectorBabelPlugin} = require('@azsxdc12356/react-native-dev-inspector/metro');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', {jsxImportSource: 'nativewind'}],
      'nativewind/babel',
    ],
    plugins: [
      inspectorBabelPlugin,
      'react-native-reanimated/plugin', // 必须放最后
    ],
  };
};
```
