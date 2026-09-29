/**
 * Import a page from a URL (Phase 10): fetch an external HTML page server-side for the
 * Campaign Builder importer. The browser can't fetch arbitrary sites (CORS), and the server
 * must not become a proxy into our own network, so:
 *   - http/https only, default ports only, no credentials in the URL;
 *   - every DNS answer is checked and the connection is pinned to the checked address
 *     (no DNS-rebinding); private, loopback, link-local (cloud metadata), CGNAT, multicast
 *     and reserved ranges are refused, IPv4 and IPv6;
 *   - at most 3 redirects, each re-checked; 10 s overall; 2 MB body; text/html only.
 * The HTML is returned as text for the normal importer (which sanitizes / isolates it);
 * relative asset URLs are made absolute so images and stylesheets keep working.
 */
const http = require("http");
const https = require("https");
const dns = require("dns");
const net = require("net");

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["text/html", "application/xhtml+xml"];
const USER_AGENT = "BusyBeansPageImporter/1.0 (+https://www.busybeancoffee.com)";

function importError(message, code = "IMPORT_URL_FAILED", status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function ipv4ToInt(ip) {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4 = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
].map(([base, bits]) => [ipv4ToInt(base), bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0]);

function isBlockedIpv4(ip) {
  const n = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, mask]) => (n & mask) >>> 0 === base);
}

function isBlockedIpv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(lower)) return true; // mapped, hex form — refuse
  const first = parseInt(lower.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (lower.startsWith("64:ff9b:")) return true; // NAT64 → could reach IPv4 private
  if (lower.startsWith("2001:db8:")) return true; // documentation
  if (lower.startsWith("2002:")) return true; // 6to4 (embeds IPv4)
  return false;
}

function isBlockedAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true;
}

/** Resolve and vet every address; returns the first one (the connection is pinned to it). */
async function resolvePublicAddress(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw importError("That address is not allowed (private or reserved network).", "IMPORT_URL_BLOCKED");
    return { address: host, family: net.isIP(host) };
  }
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) {
    throw importError("That host is not allowed.", "IMPORT_URL_BLOCKED");
  }
  let answers;
  try {
    answers = await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch {
    throw importError("Could not resolve that host name.");
  }
  if (!answers.length) throw importError("Could not resolve that host name.");
  if (answers.some((a) => isBlockedAddress(a.address))) {
    throw importError("That host resolves to a private or reserved network.", "IMPORT_URL_BLOCKED");
  }
  return answers[0];
}

function validateUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || "").trim());
  } catch {
    throw importError("Enter a full URL starting with https:// or http://.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw importError("Only http and https URLs can be imported.");
  if (url.username || url.password) throw importError("URLs with credentials are not allowed.");
  if (url.port && !["80", "443"].includes(url.port)) throw importError("Only the standard web ports (80/443) are allowed.");
  url.hash = "";
  return url;
}

function charsetOf(contentType) {
  const match = /charset=([^;]+)/i.exec(contentType || "");
  return match ? match[1].trim().replace(/^"|"$/g, "").toLowerCase() : "utf-8";
}

function decodeBody(buffer, contentType) {
  try {
    return new TextDecoder(charsetOf(contentType)).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

/** One request (no redirect following), pinned to a vetted IP. */
function requestOnce(url, deadline) {
  return new Promise((resolve, reject) => {
    resolvePublicAddress(url.hostname)
      .then(({ address, family }) => {
        const lib = url.protocol === "https:" ? https : http;
        const remaining = deadline - Date.now();
        if (remaining <= 0) return reject(importError("The page took too long to respond.", "IMPORT_URL_TIMEOUT"));
        const req = lib.request(
          url,
          {
            method: "GET",
            headers: {
              "User-Agent": USER_AGENT,
              Accept: "text/html,application/xhtml+xml;q=0.9",
              "Accept-Encoding": "identity",
            },
            // Pin the connection to the address we checked (TLS still verifies the host name).
            lookup: (_hostname, options, cb) => {
              if (options && options.all) cb(null, [{ address, family }]);
              else cb(null, address, family);
            },
            timeout: remaining,
          },
          (res) => {
            const status = res.statusCode || 0;
            if (status >= 300 && status < 400 && res.headers.location) {
              res.resume();
              return resolve({ redirect: res.headers.location });
            }
            if (status < 200 || status >= 300) {
              res.resume();
              return reject(importError(`The page returned HTTP ${status}.`));
            }
            const contentType = String(res.headers["content-type"] || "").toLowerCase();
            if (!ALLOWED_TYPES.some((t) => contentType.startsWith(t))) {
              res.resume();
              return reject(importError("That URL is not an HTML page."));
            }
            const declared = Number(res.headers["content-length"] || 0);
            if (declared > MAX_BYTES) {
              res.resume();
              return reject(importError("The page is larger than 2 MB.", "IMPORT_URL_TOO_LARGE"));
            }
            const chunks = [];
            let size = 0;
            res.on("data", (chunk) => {
              size += chunk.length;
              if (size > MAX_BYTES) {
                req.destroy();
                reject(importError("The page is larger than 2 MB.", "IMPORT_URL_TOO_LARGE"));
                return;
              }
              chunks.push(chunk);
            });
            res.on("end", () => resolve({ body: Buffer.concat(chunks), contentType }));
            res.on("error", () => reject(importError("The connection was interrupted.")));
          },
        );
        req.on("timeout", () => {
          req.destroy();
          reject(importError("The page took too long to respond.", "IMPORT_URL_TIMEOUT"));
        });
        req.on("error", (error) => {
          if (error && error.code) reject(importError(`Could not load the page (${error.code}).`));
          else reject(importError("Could not load the page."));
        });
        req.end();
        return undefined;
      })
      .catch(reject);
  });
}

const URL_ATTRS = /(\s(?:src|href|poster|data-src|action)\s*=\s*)(["'])([^"']*)\2/gi;
const SRCSET_ATTR = /(\s(?:srcset|data-srcset)\s*=\s*)(["'])([^"']*)\2/gi;
const CSS_URL = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;

function absolutize(value, base) {
  const v = value.trim();
  if (!v || /^(#|data:|mailto:|tel:|javascript:|about:|blob:)/i.test(v)) return value;
  try {
    return new URL(v, base).toString();
  } catch {
    return value;
  }
}

/** Make relative asset/link URLs absolute against the page's final URL. */
function absolutizeHtml(html, base) {
  return html
    .replace(URL_ATTRS, (_m, pre, q, v) => `${pre}${q}${absolutize(v, base)}${q}`)
    .replace(SRCSET_ATTR, (_m, pre, q, v) => {
      const out = v
        .split(",")
        .map((part) => {
          const [u, ...desc] = part.trim().split(/\s+/);
          return [absolutize(u, base), ...desc].join(" ");
        })
        .join(", ");
      return `${pre}${q}${out}${q}`;
    })
    .replace(CSS_URL, (_m, q, v) => `url(${q}${absolutize(v, base)}${q})`);
}

/**
 * @returns {Promise<{ html: string, finalUrl: string, bytes: number, title: string | null }>}
 */
async function importFromUrl(rawUrl, { requestOnceImpl = requestOnce } = {}) {
  let url = validateUrl(rawUrl);
  const deadline = Date.now() + TIMEOUT_MS;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    // eslint-disable-next-line no-await-in-loop
    const result = await requestOnceImpl(url, deadline);
    if (result.redirect) {
      if (hop === MAX_REDIRECTS) throw importError("Too many redirects.");
      url = validateUrl(new URL(result.redirect, url).toString());
      continue;
    }
    const text = decodeBody(result.body, result.contentType);
    const titleMatch = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(text);
    return {
      html: absolutizeHtml(text, url.toString()),
      finalUrl: url.toString(),
      bytes: result.body.length,
      title: titleMatch ? titleMatch[1].trim() : null,
    };
  }
  throw importError("Too many redirects.");
}

module.exports = {
  importFromUrl,
  validateUrl,
  isBlockedAddress,
  resolvePublicAddress,
  absolutizeHtml,
  requestOnce,
};
