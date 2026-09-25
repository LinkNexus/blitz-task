import { getCookie } from "./utils";

/**
 * Makes sure the antiforgery cookie exists, without ever being allowed to fail.
 *
 * <b>This used to be a bare top-level `await fetch` in `main.tsx`, and that is a white screen
 * the moment the network is gone.</b> A rejected top-level await means the entry module never
 * finishes evaluating, so React is never mounted — the service worker serves the shell and the
 * app then refuses to boot on top of it, which is strictly worse than having no cache at all.
 *
 * Nothing is lost by tolerating the failure: the token is only needed to *write*, writes are
 * refused while offline anyway, and the call below picks it up again on the next attempt once
 * there is a connection.
 */
export async function ensureCsrfToken(): Promise<void> {
  if (getCookie("XSRF-TOKEN")) return;

  try {
    await fetch("/api/csrf-token", { credentials: "include" });
  } catch {
    // Offline, or the server is down. Retried lazily before the next write.
  }
}
