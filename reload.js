(function () {
  let last = null;
  setInterval(() => {
    fetch("/__mtime__").then(r => r.json()).then(({ t }) => {
      if (last === null) { last = t; return; }
      if (t !== last) location.reload();
    }).catch(() => {});
  }, 800);
})();
