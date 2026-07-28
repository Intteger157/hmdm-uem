import type { Terminal } from 'xterm'

/** Maps browser/xterm DEL (0x7f) to Windows backspace (0x08) for remote shells. */
export function normalizeTerminalInput(data: string): string {
  if (!data.includes('\x7f')) {
    return data
  }
  return data.replace(/\x7f/g, '\x08')
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
