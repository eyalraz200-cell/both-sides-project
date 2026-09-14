// Dev-only launcher — NOT loaded by any page, never ships. Run with node.
//
// Opens a real headed Chromium window sized to a phone viewport, with no
// DevTools stealing width. Chrome's own device toolbar can't be had without
// the DevTools panel (emulation is hosted by it), so this stands in for it:
// the whole OS window IS the device.
//
//   node _debug-mobile-window.js                  # 412x915, dpr 3, project.html
//   node _debug-mobile-window.js --w 390 --h 844  # iPhone 14-ish
//   node _debug-mobile-window.js --url http://localhost:8080/index.html
//   node _debug-mobile-window.js --dpr 2 --desktop
//
// Leave it running; Ctrl-C (or closing the window) ends it.

const path = require("path");
const fs = require("fs");

const PW = path.join(process.env.HOME, ".claude/tools/pw/node_modules/playwright-core");
const { chromium } = require(PW);

// Newest installed chromium build under the playwright cache, so this keeps
// working across playwright updates instead of pinning a revision.
function chromiumExe() {
  const cache = path.join(process.env.HOME, "Library/Caches/ms-playwright");
  const builds = fs.readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const b of builds) {
    const exe = path.join(cache, b, "chrome-mac/Chromium.app/Contents/MacOS/Chromium");
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error("no headed Chromium found under " + cache);
}

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes("--" + name);

const W = Number(flag("w", 412));
const H = Number(flag("h", 915));
const DPR = Number(flag("dpr", 3));
const URL = flag("url", "http://localhost:8080/project.html");
const MOBILE = !has("desktop");

(async () => {
  const browser = await chromium.launch({
    executablePath: chromiumExe(),
    headless: false,
    // Window chrome (tab strip + toolbar) eats vertical space, so the OS
    // window is asked for more than the viewport; Playwright still pins the
    // viewport to exactly W x H below, which is the number that matters.
    args: [`--window-size=${W},${H + 90}`, "--window-position=40,40"],
  });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: DPR,
    isMobile: MOBILE,
    hasTouch: MOBILE,
    userAgent: MOBILE
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : undefined,
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  console.log(`${MOBILE ? "mobile" : "desktop"} ${W}x${H} @${DPR}x → ${URL}`);
  console.log("Ctrl-C to quit.");

  // Exit when the user closes the window rather than leaving node hanging.
  browser.on("disconnected", () => process.exit(0));
  await new Promise(() => {});
})();
