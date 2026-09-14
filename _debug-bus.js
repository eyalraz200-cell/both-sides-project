/* _debug-bus.js — harness transport. SCAFFOLDING, never ships; delete it with the
   last _debug-*.js.

   Why it exists: the harness panels used BroadcastChannel, which only reaches tabs
   in the SAME browser. The panel now has to run on the laptop while the page runs
   on a phone, so messages relay through the dev server instead (`/__bus__` in
   server.py) — long-poll in, POST out. Same API shape as BroadcastChannel, so the
   harnesses and _debug-panel.html just swap the constructor.

   It replaces BroadcastChannel rather than joining it: running both would deliver
   every same-browser message twice. */
(function () {
  if (window.HBus) return;

  var ME = Math.random().toString(36).slice(2);   // so we never hear our own posts
  var subs = {};                                  // channel name -> [port]
  var started = false;

  function pump() {
    var since = -1;                               // -1 = "from now", skip the backlog
    var quiet = 0;
    (function loop() {
      fetch('/__bus__?since=' + since, { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          quiet = 0;
          since = d.n;
          (d.msgs || []).forEach(function (e) {
            if (e.from === ME) return;
            (subs[e.ch] || []).forEach(function (p) {
              if (p.onmessage) { try { p.onmessage({ data: e.msg }); } catch (err) {} }
            });
          });
          loop();
        })
        .catch(function () {
          /* Server restarted, Wi-Fi blipped, phone asleep. Back off a little and
             keep trying — the panel must survive the dev server's restarts. */
          quiet = Math.min(quiet + 1, 5);
          setTimeout(loop, 300 * quiet);
        });
    })();
  }

  window.HBus = function (name) {
    var port = { name: name, onmessage: null, close: function () {} };
    port.postMessage = function (msg) {
      try {
        fetch('/__bus__', {
          method: 'POST', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ch: name, from: ME, msg: msg })
        }).catch(function () {});
      } catch (e) {}
    };
    (subs[name] = subs[name] || []).push(port);
    if (!started) { started = true; pump(); }
    return port;
  };
})();
