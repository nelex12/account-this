// lock.ts — "one at a time" for work that must not overlap: here and in other tabs.
// Web Locks API when the browser has it (all current ones do), otherwise a chain of promises
// inside this tab (also what the unit tests run on).
const chains = new Map<string, Promise<unknown>>();

export function withLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(name, task);
  }
  const previous = chains.get(name) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(task);
  chains.set(name, run);
  return run;
}

/** Everything that rewrites the issuer's registry or journal status takes this lock. */
export const ISSUER_DATA_LOCK = 'account-this:issuer-data';
