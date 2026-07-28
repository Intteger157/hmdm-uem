/** Maps browser/xterm DEL (0x7f) to Windows backspace (0x08) for remote shells. */
export function normalizeTerminalInput(data: string): string {
  if (!data.includes('\x7f')) {
    return data
  }
  return data.replace(/\x7f/g, '\x08')
}
