// src/api/authBridge.ts
//
// Module-level glue between the React-owned session (AuthProvider) and the
// plain-TS http layer (apiFetch). The token itself lives only in memory,
// inside AuthProvider.

type GetToken = () => string | null;
type RefreshSession = () => Promise<string | null>;
type SignOut = () => void;

let getTokenImpl: GetToken = () => null;
let refreshImpl: RefreshSession = async () => null;
let signOutImpl: SignOut = () => {};

/**
 * Called by AuthProvider to wire the current token getter, the (single,
 * deduplicated, cross-tab-locked) refresh routine and the local sign-out.
 */
export function registerAuthBridge(handlers: {
  getToken: GetToken;
  refresh: RefreshSession;
  signOut: SignOut;
}): void {
  getTokenImpl = handlers.getToken;
  refreshImpl = handlers.refresh;
  signOutImpl = handlers.signOut;
}

export function readToken(): string | null {
  return getTokenImpl();
}

export function runRefresh(): Promise<string | null> {
  return refreshImpl();
}

/** Forget the session locally (no server call) -> router shows the login screen. */
export function runSignOut(): void {
  signOutImpl();
}