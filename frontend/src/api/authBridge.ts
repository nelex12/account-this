// src/api/authBridge.ts

type GetToken = () => string | null;
type RefreshSession = () => Promise<string | null>;

let getTokenImpl: GetToken = () => null;
let refreshImpl: RefreshSession = async () => null;

/**
 * Called once by AuthProvider on mount to wire the current token getter
 * and the refresh routine into the module-level bridge.
 */
export function registerAuthBridge(handlers: {
  getToken: GetToken;
  refresh: RefreshSession;
}): void {
  getTokenImpl = handlers.getToken;
  refreshImpl = handlers.refresh;
}

export function readToken(): string | null {
  return getTokenImpl();
}

export function runRefresh(): Promise<string | null> {
  return refreshImpl();
}