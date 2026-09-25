import { useEffect, useState } from "react";

/**
 * The cache the service worker fills with API reads. Named in one place because two things need
 * it: the worker writes it, and logout empties it.
 */
export const API_CACHE = "blitz-api-reads";

/** Verbs that change something. Everything else is a read and may come from the cache. */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const isWrite = (method: string) =>
  WRITE_METHODS.has(method.toUpperCase());

/**
 * Empties the cached API reads.
 *
 * <b>Called on logout, and that is not optional.</b> A cached board belongs to whoever was
 * signed in when it was fetched; on a shared device the next person to open the app would
 * otherwise be served the previous one's projects from disk, with no request ever made.
 */
export async function clearApiCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(API_CACHE);
  } catch {
    // A browser that will not let us clear it is not a reason to block signing out.
  }
}

/**
 * Whether the browser believes it has a network.
 *
 * `onLine === false` is trustworthy — there is definitely no connection. `true` only means an
 * interface is up, not that anything is reachable, so it is used to *stop* blocking rather than
 * to promise that a request will succeed.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
