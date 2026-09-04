"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether this request resolved to a real, authorized session — decided
 * once, server-side, by `(app)/layout.tsx` calling `resolveAuthContext()`,
 * and handed down through context rather than re-derived client-side.
 *
 * This is what lets `(app)/page.tsx` know synchronously, on the very first
 * render (server and client alike), whether to show the customer dashboard
 * or the marketing homepage — no client fetch to wait on, so no flash of
 * one before the other, and the server-rendered HTML a crawler or a
 * signed-out visitor's first paint sees is always correct immediately.
 */
const AuthStateContext = createContext(false);

export function AuthStateProvider({
  authenticated,
  children,
}: {
  authenticated: boolean;
  children: ReactNode;
}) {
  return <AuthStateContext.Provider value={authenticated}>{children}</AuthStateContext.Provider>;
}

export function useIsAuthenticated(): boolean {
  return useContext(AuthStateContext);
}
