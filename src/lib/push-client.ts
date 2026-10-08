// Public VAPID key + helpers for Web Push subscription on the client.
// The public key is safe to expose.
export const VAPID_PUBLIC_KEY =
  "BEhsP8fow1hPZaMtOCYxW_D-JtqHb7xWGActPcDiVPo_K9OEutoj73JbO7sXJetJRKEdDQs3rP6ifjxzx0Ny25o";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function ensurePushRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/push-sw.js");
  if (existing) return existing;
  return await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;
  const reg = await ensurePushRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }
  return sub;
}

export function subscriptionToJSON(sub: PushSubscription) {
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  return {
    endpoint: j.endpoint ?? sub.endpoint,
    p256dh: j.keys?.p256dh ?? "",
    auth: j.keys?.auth ?? "",
  };
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
