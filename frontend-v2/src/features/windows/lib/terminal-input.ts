import type { Terminal } from 'xterm'

/** xterm sends DEL (0x7f) for Backspace; PSReadLine expects that for single-char delete. */
export function normalizeTerminalInput(data: string): string {
  return data
}

export function buildTerminalResizeMessage(cols: number, rows: number): string {
  return JSON.stringify({ type: 'resize', cols, rows })
}

export function writeSocketPayload(terminal: Terminal, data: unknown): void {
  if (typeof data === 'string') {
    terminal.write(data)
    return
  }
  if (data instanceof ArrayBuffer) {
    terminal.write(new Uint8Array(data))
  }
}
