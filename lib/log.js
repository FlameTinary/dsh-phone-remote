import fs from 'node:fs';
import { inspect } from 'node:util';

/**
 * Append to a size-capped log file and mirror to the Host console.
 * Returns a logger(...args) function.
 */
export function createLogger(paths, { maxBytes = 1024 * 1024, echo = true, file = paths.logFile, label = 'dsh-phone-remote' } = {}) {
  let size = 0;
  try {
    size = fs.statSync(file).size;
  } catch {
    // First run.
  }

  function write(line) {
    try {
      fs.mkdirSync(paths.dir, { recursive: true, mode: 0o700 });
      if (size > maxBytes) {
        try {
          fs.renameSync(file, `${file}.1`);
        } catch {
          // If rotation fails, truncate instead of growing forever.
          fs.writeFileSync(file, '');
        }
        size = 0;
      }
      fs.appendFileSync(file, `${line}\n`, { mode: 0o600 });
      size += Buffer.byteLength(line) + 1;
    } catch {
      // Logging must never break the listener.
    }
    if (echo) {
      try {
        console.log(line);
      } catch {
        // Ignore a closed console.
      }
    }
  }

  return (...args) => {
    const text = args
      .map((arg) => (typeof arg === 'string' ? arg : inspect(arg, { depth: 2, breakLength: 160 })))
      .join(' ');
    write(`${new Date().toISOString()} [${label}] ${text}`);
  };
}
