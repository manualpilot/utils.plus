import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

function toBase64Url(str: string): string {
  const encoded = btoa(unescape(encodeURIComponent(str)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url: string): string {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return decodeURIComponent(escape(atob(b64)));
}

type GetStateFn = () => Record<string, unknown> | null;

interface ShareStateContextValue {
  registerGetState: (fn: GetStateFn) => void;
  unregisterGetState: () => void;
  getShareUrl: () => string | null;
  syncHash: () => void;
  clearHash: () => void;
}

const ShareStateContext = createContext<ShareStateContextValue | null>(null);

const HASH_SYNC_DELAY = 250;

const MAX_TRACKED_HASH_LENGTH = 64 * 1024;

export function ShareStateProvider({ children }: { children: ReactNode }) {
  const getStateFnRef = useRef<GetStateFn | null>(null);
  const baselineRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      if (decodeHashState(window.location.hash)) window.location.reload();
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const cancelPendingWrite = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const registerGetState = useCallback((fn: GetStateFn) => {
    getStateFnRef.current = fn;
    baselineRef.current = encodeState(fn());
  }, []);

  const unregisterGetState = useCallback(() => {
    cancelPendingWrite();
    getStateFnRef.current = null;
    baselineRef.current = null;
  }, [cancelPendingWrite]);

  const writeHash = useCallback(() => {
    const encoded = encodeState(getStateFnRef.current?.() ?? null);
    if (encoded === null || encoded.length > MAX_TRACKED_HASH_LENGTH) return;
    const current = window.location.hash.slice(1);
    if (current === encoded) return;
    if (!current && encoded === baselineRef.current) return;
    history.replaceState(history.state, "", urlWithHash(encoded));
  }, []);

  const syncHash = useCallback(() => {
    cancelPendingWrite();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      writeHash();
    }, HASH_SYNC_DELAY);
  }, [cancelPendingWrite, writeHash]);

  useEffect(() => cancelPendingWrite, [cancelPendingWrite]);

  const getShareUrl = useCallback((): string | null => {
    const encoded = encodeState(getStateFnRef.current?.() ?? null);
    if (encoded === null) return null;
    cancelPendingWrite();
    const url = urlWithHash(encoded);
    const displayable = encoded.length <= MAX_TRACKED_HASH_LENGTH;
    if (displayable && window.location.hash.slice(1) !== encoded) {
      history.replaceState(history.state, "", url);
    }
    return url;
  }, [cancelPendingWrite]);

  const clearHash = useCallback(() => {
    cancelPendingWrite();
    baselineRef.current = encodeState(getStateFnRef.current?.() ?? null);
    const url = new URL(window.location.href);
    url.hash = "";
    history.replaceState(history.state, "", url.toString());
  }, [cancelPendingWrite]);

  const value = useMemo(
    () => ({ registerGetState, unregisterGetState, getShareUrl, syncHash, clearHash }),
    [registerGetState, unregisterGetState, getShareUrl, syncHash, clearHash],
  );

  return <ShareStateContext.Provider value={value}>{children}</ShareStateContext.Provider>;
}

function urlWithHash(encoded: string): string {
  const url = new URL(window.location.href);
  url.hash = encoded;
  return url.toString();
}

function encodeState(state: Record<string, unknown> | null): string | null {
  if (!state) return null;
  try {
    return toBase64Url(JSON.stringify(state));
  } catch {
    return null;
  }
}

export function useShareStateContext() {
  return useContext(ShareStateContext);
}

export function useInitialHashState<T extends Record<string, unknown>>(): T | null {
  const [initialState] = useState<T | null>(() => decodeHashState<T>(window.location.hash));

  return initialState;
}

function decodeHashState<T>(hash: string): T | null {
  const payload = hash.slice(1);
  if (!payload) return null;
  try {
    return JSON.parse(fromBase64Url(payload)) as T;
  } catch {
    return null;
  }
}

export function useRegisterShareState(getState: () => Record<string, unknown>) {
  const ctx = useShareStateContext();
  const getStateRef = useRef(getState);
  getStateRef.current = getState;

  useEffect(() => {
    if (!ctx) return;
    ctx.registerGetState(() => getStateRef.current());
    return () => ctx.unregisterGetState();
  }, [ctx]);

  const syncShareState = useCallback(() => ctx?.syncHash(), [ctx]);

  useEffect(() => {
    syncShareState();
  });

  return syncShareState;
}
