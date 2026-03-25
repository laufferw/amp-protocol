// Shim for bun:ffi - provides dummy types/stubs for browser environment
export type Pointer = number

export function toArrayBuffer(_ptr: Pointer, _offset: number, _size: number): ArrayBuffer {
  return new ArrayBuffer(0)
}

export function ptr(_buf: ArrayBuffer): Pointer {
  return 0
}

export function read(ptr: Pointer): { ptr: Pointer } {
  return { ptr: 0 }
}

export function dlopen(_path: string, _symbols: Record<string, unknown>): { symbols: Record<string, unknown>; close(): void } {
  return { symbols: {}, close() {} }
}

export class JSCallback {
  ptr: Pointer = 0
  constructor(_fn: (...args: unknown[]) => unknown, _options?: unknown) {}
  close() {}
}

export function suffix(): string {
  return ""
}
