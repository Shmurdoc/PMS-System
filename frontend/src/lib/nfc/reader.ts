// Web Serial path for NFC readers — off unless VITE_NFC_READER is set
// (VITE_NFC_READER=1 npm run dev) and the browser exposes serial; hidden
// otherwise. Protocol stays device-agnostic: firmware that streams the tag
// id as printable ASCII, one per line — ASCII-hex readers or a keyboard-
// wedge scanner alike. Manual UID entry remains the always-available path.

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
};

type SerialLike = {
  requestPort(): Promise<SerialPortLike>;
};

export type TagListener = (tagNumber: string) => void;

export interface ConnectOptions {
  /** Most reader firmwares default here — override when the device differs. */
  baudRate?: number;
}

/** One non-space ASCII token, tag-number length — drops framing junk. */
const LINE_TOKEN = /^[\x21-\x7E]{1,64}$/;

function flagEnabled(): boolean {
  const value: unknown = import.meta.env['VITE_NFC_READER'];
  return value === '1' || value === 'true' || value === 'enabled';
}

export function isSerialReaderEnabled(): boolean {
  if (!flagEnabled()) return false;
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Asks the browser for a port (user gesture required), then emits every
 * line-delimited tag id to onTag until the returned function is called or
 * the device disappears. Rejects only when the port cannot open — a mid-run
 * unplug ends the stream quietly.
 */
export async function connectSerialReader(
  onTag: TagListener,
  options: ConnectOptions = {},
): Promise<() => Promise<void>> {
  const serial = (navigator as Navigator & { serial?: SerialLike }).serial;
  if (!serial) throw new Error('Web Serial is not available in this browser');

  const port = await serial.requestPort();
  await port.open({ baudRate: options.baudRate ?? 115200 });

  const pump = (async () => {
    if (!port.readable) return;
    const reader = port.readable.getReader();
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        buffer += new TextDecoder().decode(value);
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const token = line.trim();
          if (LINE_TOKEN.test(token)) onTag(token);
        }
      }
    } catch {
      // device unplugged or port closed — manual entry keeps working
    } finally {
      reader.releaseLock();
    }
  })();

  return async () => {
    try {
      await port.close();
    } catch {
      // already gone — nothing left to close
    }
    await pump;
  };
}
