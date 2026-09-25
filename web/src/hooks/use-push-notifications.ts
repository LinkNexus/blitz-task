import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createPushSubscriptionMutation,
  deletePushSubscriptionMutation,
  getPushConfigurationOptions,
} from "@/api/@tanstack/react-query.gen";

/**
 * A base64url VAPID key as the subscription API wants it — a `Uint8Array`.
 *
 * `applicationServerKey` accepts nothing else, and the key travels as base64url, whose `-` and
 * `_` `atob` does not understand. Getting this wrong fails at subscribe time with a message
 * about an invalid key rather than anything about encoding.
 */
function decodeVapidKey(base64Url: string): ArrayBuffer {
  const padded = base64Url.padEnd(
    base64Url.length + ((4 - (base64Url.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));

  // Returned as the ArrayBuffer rather than the view: `applicationServerKey` is typed
  // `BufferSource`, and a `Uint8Array`'s buffer is `ArrayBufferLike`, which does not satisfy it.
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export type PushState =
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "off"
  | "on";

/**
 * Turning OS notifications on and off for this device.
 *
 * Permission is never requested on load. A prompt someone did not ask for is the reliable way
 * to have it denied permanently — and a denial cannot be undone from the page, only from
 * browser settings, so the one cost that matters here is irreversible.
 */
export function usePushNotifications() {
  const queryClient = useQueryClient();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // Only asked for when the browser could act on it; an instance with no keypair configured
  // should not advertise the feature at all.
  const { data: configuration } = useQuery({
    ...getPushConfigurationOptions(),
    enabled: supported,
  });

  useEffect(() => {
    if (!supported) return;

    // The truth lives in the browser, not in our database: a subscription survives a logout and
    // can be revoked from browser settings without telling us.
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setSubscribed(!!subscription))
      .catch(() => setSubscribed(false));
  }, [supported]);

  const subscribeMutation = useMutation(createPushSubscriptionMutation());
  const unsubscribeMutation = useMutation(deletePushSubscriptionMutation());

  const state: PushState = !supported
    ? "unsupported"
    : !configuration?.publicKey
      ? "unconfigured"
      : Notification.permission === "denied"
        ? "denied"
        : subscribed
          ? "on"
          : "off";

  const enable = useCallback(async () => {
    const publicKey = configuration?.publicKey;
    if (!publicKey) return;

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications are blocked for this site");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push that shows nothing is not allowed, which is also
        // why the worker always displays something.
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });

      const json = subscription.toJSON();
      await subscribeMutation.mutateAsync({
        body: {
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        },
      });

      setSubscribed(true);
      queryClient.invalidateQueries({ queryKey: ["getPushConfiguration"] });
      toast.success("Notifications on for this device");
    } catch (error) {
      toast.error("Could not turn on notifications");
      console.error(error);
    } finally {
      setBusy(false);
    }
  }, [configuration?.publicKey, queryClient, subscribeMutation]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Told first, then dropped locally. The other order leaves a row the server will keep
        // pushing to until the endpoint answers Gone.
        await unsubscribeMutation
          .mutateAsync({ query: { endpoint: subscription.endpoint } })
          .catch(() => undefined);
        await subscription.unsubscribe();
      }

      setSubscribed(false);
      toast.success("Notifications off for this device");
    } catch {
      toast.error("Could not turn off notifications");
    } finally {
      setBusy(false);
    }
  }, [unsubscribeMutation]);

  return { state, busy, enable, disable };
}
