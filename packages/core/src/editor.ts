/**
 * Editor launching utilities
 * Handles opening source files in the user's preferred editor
 *
 * Uses standard endpoints compatible with react-dev-inspector:
 * - /__inspect-open-in-editor (primary)
 * - /__open-stack-frame-in-editor (legacy)
 */

import {Platform, Linking, NativeModules, TurboModuleRegistry} from 'react-native';
import type {CodeInfo} from './fiber';

export interface LaunchEditorOptions {
  /** Source code information */
  codeInfo: CodeInfo;
  /** Editor name or command */
  editor?: string;
  /** Dev server URL (for Metro-based launching) */
  devServerUrl?: string;
}

/**
 * Derive the dev server origin from the URL the app actually loaded its
 * bundle from (NativeModules.SourceCode.scriptURL). This makes "Open in
 * editor" work out of the box on real devices over LAN, emulators and
 * adb-reverse setups alike, without hardcoding devServerUrl.
 */
function getScriptUrlOrigin(): string | null {
  try {
    // SourceCode is a TurboModule on newer RN (under bridgeless, legacy
    // NativeModules still returns an interop proxy). scriptURL lives in
    // getConstants() rather than as a direct module property (the legacy
    // bridge flattens constants, bridgeless does not) — try both paths.
    const mod: any = NativeModules?.SourceCode ?? (TurboModuleRegistry as any)?.get?.('SourceCode');
    const scriptURL: string | undefined = mod?.scriptURL ?? mod?.getConstants?.()?.scriptURL;
    if (!scriptURL) return null;
    const match = scriptURL.match(/^https?:\/\/[^/?#]+/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

/**
 * Default dev server URL based on platform
 */
function getDefaultDevServerUrl(): string {
  const origin = getScriptUrlOrigin();
  if (origin) {
    return origin;
  }
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 for localhost
    return 'http://10.0.2.2:8081';
  }
  // iOS simulator uses localhost
  return 'http://localhost:8081';
}

/**
 * Build query string for editor endpoint
 */
function buildEditorQueryString(codeInfo: CodeInfo, editor?: string): string {
  // Use absolutePath if available, otherwise relativePath
  const file = codeInfo.absolutePath || codeInfo.relativePath;
  const entries: Array<[string, string | number | undefined]> = [
    ['file', file],
    ['line', codeInfo.lineNumber],
    ['column', codeInfo.columnNumber],
    ['editor', editor],
  ];

  // Capability detection must be behavioral: RN 0.72's URL polyfill
  // (Libraries/Blob/URL.js) "has" set() on its prototype, but calling it
  // throws "URLSearchParams.set is not implemented" — a typeof check alone
  // would be a false positive.
  const NativeParams = (globalThis as any).URLSearchParams;
  if (typeof NativeParams === 'function') {
    try {
      const params = new NativeParams();
      for (const [key, value] of entries) {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      }
      const qs = params.toString();
      if (typeof qs === 'string') return qs;
    } catch {
      // Probe failed, fall through to the manual fallback
    }
  }

  // Fallback: manual concatenation (encodeURIComponent, skip empty values)
  const parts: string[] = [];
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join('&');
}

/**
 * Launch editor via standard inspector endpoint (react-dev-inspector compatible)
 * Uses GET request with query parameters
 */
export async function launchEditorViaInspector(
  options: LaunchEditorOptions,
): Promise<boolean> {
  const {codeInfo, devServerUrl, editor} = options;
  const baseUrl = devServerUrl || getDefaultDevServerUrl();

  // Standard endpoint (react-dev-inspector style)
  const queryString = buildEditorQueryString(codeInfo, editor);
  const url = `${baseUrl}/__inspect-open-in-editor?${queryString}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Launch editor via legacy Metro endpoint
 * Uses POST request with JSON body
 */
export async function launchEditorViaMetro(
  options: LaunchEditorOptions,
): Promise<boolean> {
  const {codeInfo, devServerUrl} = options;
  const baseUrl = devServerUrl || getDefaultDevServerUrl();

  // Legacy endpoint (CRA/Metro style)
  const url = `${baseUrl}/__open-stack-frame-in-editor`;

  const queryString = buildEditorQueryString(codeInfo, options.editor);

  try {
    const response = await fetch(`${url}?${queryString}`, {
      method: 'GET',
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Generate a URL scheme for common editors
 * Used as fallback when Metro endpoint is not available
 */
function getEditorUrl(codeInfo: CodeInfo, editor?: string): string | null {
  const { absolutePath, relativePath, lineNumber, columnNumber } = codeInfo;
  // Prefer absolute path for reliable file opening
  const file = absolutePath || relativePath;
  const line = lineNumber;
  const column = columnNumber;
  const editorName = (editor || 'vscode').toLowerCase();

  switch (editorName) {
    // VS Code and variants - format: scheme://file/path:line:column
    case 'vscode':
    case 'code':
      return `vscode://file${file}:${line}:${column}`;

    case 'vscode-insiders':
      return `vscode-insiders://file${file}:${line}:${column}`;

    case 'cursor':
      return `cursor://file${file}:${line}:${column}`;

    // JetBrains IDEs - format: jetbrains://ide/navigate/reference?path=file&line=n&column=n
    // Note: JetBrains uses 1-indexed line but 0-indexed column
    case 'webstorm':
    case 'phpstorm':
    case 'intellij':
    case 'idea':
    case 'pycharm':
    case 'rubymine':
    case 'goland':
    case 'rider':
    case 'clion':
      return `jetbrains://${editorName}/navigate/reference?project=&path=${encodeURIComponent(file)}&line=${line}&column=${Math.max(0, column - 1)}`;

    // Sublime Text - format: subl://open?url=file://path&line=n&column=n
    case 'sublime':
    case 'subl':
      return `subl://open?url=file://${encodeURIComponent(file)}&line=${line}&column=${column}`;

    // Atom editor - format: atom://core/open/file?filename=path&line=n&column=n
    case 'atom':
      return `atom://core/open/file?filename=${encodeURIComponent(file)}&line=${line}&column=${column}`;

    // Zed editor - format: zed://open/path:line:column
    case 'zed':
      return `zed://open${file}:${line}:${column}`;

    default:
      return null;
  }
}

/**
 * Try to launch editor via URL scheme (deep linking)
 */
export async function launchEditorViaUrlScheme(options: LaunchEditorOptions): Promise<boolean> {
  const { codeInfo, editor } = options;
  const url = getEditorUrl(codeInfo, editor);

  if (!url) {
    return false;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Main function to launch editor
 * Tries multiple methods in order of preference:
 * 1. Standard inspector endpoint (/__inspect-open-in-editor)
 * 2. Legacy Metro endpoint (/__open-stack-frame-in-editor)
 * 3. URL scheme (deep linking to editor app)
 */
export async function launchEditor(
  options: LaunchEditorOptions,
): Promise<boolean> {
  // Try standard inspector endpoint first (react-dev-inspector compatible)
  const inspectorSuccess = await launchEditorViaInspector(options);
  if (inspectorSuccess) {
    return true;
  }

  // Fall back to legacy Metro endpoint
  const metroSuccess = await launchEditorViaMetro(options);
  if (metroSuccess) {
    return true;
  }

  // Fall back to URL scheme (direct app deep linking)
  const urlSuccess = await launchEditorViaUrlScheme(options);
  if (urlSuccess) {
    return true;
  }

  return false;
}

/**
 * Check if dev server is reachable
 */
export async function checkDevServer(devServerUrl?: string): Promise<boolean> {
  const baseUrl = devServerUrl || getDefaultDevServerUrl();

  // Try our status endpoint first
  try {
    const response = await fetch(`${baseUrl}/__rn_dev_inspector__/status`, {
      method: 'GET',
    });
    if (response.ok) {
      return true;
    }
  } catch {
    // Continue to fallback
  }

  // Fall back to Metro's status endpoint
  try {
    const response = await fetch(`${baseUrl}/status`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}
