/**
 * Import-from-URL safety checks (Phase 10). No database; the "live" case needs internet.
 *   node marketing/scripts/importFromUrlTest.js
 */
const {
  importFromUrl,
  validateUrl,
  isBlockedAddress,
  absolutizeHtml,
  requestOnce,
} = require("../services/importFromUrl.service");

let failures = 0;
function check(condition, label) {
  if (!condition) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`${condition ? "ok  " : "FAIL"} ${label}`);
}

async function rejects(promise, codeOrText, label) {
  try {
    await promise;
    check(false, `${label} (resolved)`);
  } catch (error) {
    check(String(error.code).includes(codeOrText) || String(error.message).includes(codeOrText), `${label} → ${error.code}: ${error.message}`);
  }
}

async function run() {
  for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "172.20.0.1", "192.168.1.4", "100.64.1.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "2002:a00:1::"]) {
    check(isBlockedAddress(ip), `blocked ${ip}`);
  }
  for (const ip of ["8.8.8.8", "93.184.215.14", "172.32.0.1", "2606:4700::1111"]) {
    check(!isBlockedAddress(ip), `allowed ${ip}`);
  }

  for (const [url, label] of [
    ["file:///etc/passwd", "file: scheme"],
    ["ftp://example.com/", "ftp: scheme"],
    ["http://user:pw@example.com/", "credentials"],
    ["http://example.com:8080/", "non-standard port"],
    ["not a url", "garbage"],
  ]) {
    let threw = false;
    try {
      validateUrl(url);
    } catch {
      threw = true;
    }
    check(threw, `rejects ${label}`);
  }

  await rejects(importFromUrl("http://localhost/"), "IMPORT_URL_BLOCKED", "localhost");
  await rejects(importFromUrl("http://127.0.0.1/"), "IMPORT_URL_BLOCKED", "loopback IP");
  await rejects(importFromUrl("http://169.254.169.254/latest/meta-data/"), "IMPORT_URL_BLOCKED", "cloud metadata IP");
  await rejects(importFromUrl("http://[::1]/"), "IMPORT_URL_BLOCKED", "IPv6 loopback");
  await rejects(importFromUrl("http://2130706433/"), "IMPORT_URL_BLOCKED", "decimal-encoded 127.0.0.1");

  // A public page that redirects into the private network is refused at the next hop.
  let hop = 0;
  await rejects(
    importFromUrl("https://example.com/", {
      requestOnceImpl: (url, deadline) => (hop++ === 0 ? Promise.resolve({ redirect: "http://127.0.0.1/admin" }) : requestOnce(url, deadline)),
    }),
    "IMPORT_URL_BLOCKED",
    "redirect to loopback",
  );
  await rejects(
    importFromUrl("https://example.com/", { requestOnceImpl: () => Promise.resolve({ redirect: "/again" }) }),
    "Too many redirects",
    "redirect loop capped",
  );

  const html = absolutizeHtml(
    `<img src="/a.png"><img src="data:image/png;base64,xx"><a href="#top">t</a><a href="page.html">p</a>
     <img srcset="/s1.png 1x, /s2.png 2x"><div style="background:url('/bg.jpg')"></div>`,
    "https://site.example/dir/index.html",
  );
  check(html.includes(`src="https://site.example/a.png"`), "absolute src");
  check(html.includes(`src="data:image/png;base64,xx"`), "data: kept");
  check(html.includes(`href="#top"`), "fragment kept");
  check(html.includes(`href="https://site.example/dir/page.html"`), "relative href resolved");
  check(html.includes(`https://site.example/s1.png 1x, https://site.example/s2.png 2x`), "srcset");
  check(html.includes(`url('https://site.example/bg.jpg')`), "css url()");

  try {
    const live = await importFromUrl("https://example.com/");
    check(live.html.includes("<html") && live.bytes > 0, `live fetch example.com (${live.bytes} bytes, title "${live.title}")`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(`skip live fetch (no internet?): ${error.message}`);
  }

  if (failures) throw new Error(`${failures} check(s) failed`);
  // eslint-disable-next-line no-console
  console.log("[import-url] passed");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[import-url] failed:", error.message);
    process.exit(1);
  });
