/* Dev-only auto-reload: polls server.py's /__mtime__ and reloads when a
   watched file's mtime changes.

   Gated to local hosts. Only server.py serves /__mtime__, so anywhere else
   (GitHub Pages above all) every single poll 404s — once per 800ms, forever,
   with no user action needed. That buried the real errors in the deployed
   console under an ever-climbing pile of identical 404s. `catch(() => {})`
   below silences the *rejection*, but not the browser's own network-error
   log line, so swallowing the error is not enough: the poller must not run. */
(function () {
  const host = location.hostname;
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]" ||
    host === "" ||                       // file://
    host.endsWith(".local");             // Bonjour name, e.g. testing on a phone
  if (!isLocal) return;

  let last = null;
  setInterval(() => {
    fetch("/__mtime__").then(r => r.json()).then(({ t }) => {
      if (last === null) { last = t; return; }
      if (t !== last) location.reload();
    }).catch(() => {});
  }, 800);
})();
