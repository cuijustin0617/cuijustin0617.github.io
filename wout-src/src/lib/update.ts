/**
 * Self-update for installed (home-screen) and browser use: when a newer build is deployed,
 * reload into it. Unsynced edits are already persisted on the device, so nothing is lost.
 * Checks on launch, whenever the app comes back to the foreground, and every 15 minutes.
 */
const CHECK_EVERY = 15 * 60_000;

async function latestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.build === 'string' ? data.build : null;
  } catch { return null; }
}

/** Don't yank the page while someone is typing a number or has a sheet open. */
const busy = () => {
  const el = document.activeElement;
  return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) || !!document.querySelector('[role="dialog"]');
};

export function startUpdateChecks() {
  if (import.meta.env.DEV) return;
  // Drop the cache-busting ?v= left by a previous update reload.
  if (new URLSearchParams(window.location.search).has('v')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }
  let pending: string | null = null;
  const apply = (build: string) => {
    // A unique URL guarantees a fresh index.html instead of a cached one.
    window.location.replace(`${window.location.pathname}?v=${build}${window.location.hash}`);
  };
  const check = async (fromForeground: boolean) => {
    const build = pending ?? (await latestBuild());
    if (!build || build === __BUILD_ID__) return;
    pending = build;
    if (fromForeground || !busy()) apply(build);
  };
  window.setTimeout(() => void check(true), 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void check(true); });
  window.setInterval(() => { if (document.visibilityState === 'visible') void check(false); }, CHECK_EVERY);
}
