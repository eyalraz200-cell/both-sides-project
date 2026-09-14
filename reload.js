/* Dev-only auto-reload: polls server.py's /__mtime__ and reloads when a
   watched file's mtime changes.

   Gated to local hosts. Only server.py serves /__mtime__, so anywhere else
   (GitHub Pages above all) every single poll 404s — once per 800ms, forever,
   with no user action needed. That buried the real errors in the deployed
   console under an ever-climbing pile of identical 404s. `catch(() => {})`
   below silences the *rejection*, but not the browser's own network-error
   log line, so swallowing the error is not enough: the poller must not run. */
(function () {
  // Deliberately its OWN copy of isLocalHost() (js/core.js) rather than a call
  // to it: this poller is what picks up the fix when core.js is the file that
  // threw, so it must not depend on core.js having parsed. Keep the two in sync.
  const host = location.hostname;
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]" ||
    host === "" ||                       // file://
    host.endsWith(".local") ||           // Bonjour name, e.g. testing on a phone
    // …and the LAN IP the phone actually gets when it hits the Mac directly
    // (http://192.168.x.x:8080). Without these the poller silently switched off
    // on device, so a phone kept showing a stale page through every edit — the
    // symptom reads as "the change didn't work", which is far more expensive
    // than the 404s the gate exists to stop. Private ranges only: a deployed
    // public host still never polls.
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (!isLocal) return;

  /* SCROLL RESTORE — an auto-reload used to land at the top (or wherever the
     browser's own restore guessed), so every edit meant scrolling back to the
     fold under review. The position is saved right before reloading and put
     back once layout has settled; ScrollTrigger.refresh() re-syncs any pins
     the restore skipped over. */
  const YKEY = "reload:y";
  try {
    const y = sessionStorage.getItem(YKEY);
    if (y !== null) {
      sessionStorage.removeItem(YKEY);
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      const restore = () => {
        window.scrollTo(0, Number(y));
        if (window.ScrollTrigger && ScrollTrigger.refresh) ScrollTrigger.refresh();
      };
      addEventListener("load", () => requestAnimationFrame(() => requestAnimationFrame(restore)));
    }
  } catch (e) {}

  let last = null;
  setInterval(() => {
    fetch("/__mtime__").then(r => r.json()).then(({ t }) => {
      if (last === null) { last = t; return; }
      if (t !== last) {
        try { sessionStorage.setItem(YKEY, String(window.scrollY)); } catch (e) {}
        location.reload();
      }
    }).catch(() => {});
  }, 800);
})();
