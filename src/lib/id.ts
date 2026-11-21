/**
 * Stable, sortable identifiers (time-ordered base36 + random suffix).
 * IDs are not secrets, so Math.random is sufficient; they only need to be
 * unique on one device and safe to merge in a future cloud sync.
 */
let lastTime = 0;
let sequence = 0;

export function createId(prefix?: string): string {
  const now = Date.now();
  if (now === lastTime) {
    sequence += 1;
  } else {
    lastTime = now;
    sequence = 0;
  }
  const time = now.toString(36).padStart(9, '0');
  const seq = sequence.toString(36).padStart(2, '0');
  const random = Array.from({ length: 8 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  const id = `${time}${seq}${random}`;
  return prefix ? `${prefix}_${id}` : id;
}
