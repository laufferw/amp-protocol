// @gridland/bun type declarations.
// Re-exports everything from @gridland/utils (hooks/types) plus engine + native exports.

export * from "@gridland/utils"

// Engine types re-exported from core (bundled monolithically in dist/index.js)
// These are too numerous to enumerate — consumers get them from the JS bundle.
// Key engine exports include: Renderable, renderables, buffer types, zig-registry,
// reconciler (createRoot, _render, reconciler), component catalogue, Yoga, etc.

// Native-only exports — types inlined to avoid dependency on @opentui/core/native
export declare class CliRenderer {
  constructor(...args: any[])
  destroy(): void
  start(): void
  [key: string]: any
}

export declare enum CliRenderEvents {
  render = "render",
  resize = "resize",
}

export declare function createCliRenderer(config?: any): Promise<CliRenderer>

export declare class MouseEvent {
  x: number
  y: number
  button: number
  [key: string]: any
}

export declare class TerminalConsole {
  constructor(...args: any[])
  [key: string]: any
}

export declare enum ConsolePosition {
  top = "top",
  bottom = "bottom",
}

export declare const capture: any

export declare class NativeSpanFeed {
  constructor(...args: any[])
  [key: string]: any
}

export declare function setRenderLibPath(libPath: string): void
