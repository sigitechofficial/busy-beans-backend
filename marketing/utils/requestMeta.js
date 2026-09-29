/**
 * Request metadata helpers for public marketing endpoints (Phase 11).
 *
 * isBotUserAgent — crawlers, link previewers, headless browsers, monitoring and HTTP libraries.
 *   Tracking from these is dropped so reports count people; leads are never dropped.
 * leadIpForStorage — MARKETING_LEAD_IP_MODE: "anonymized" (default; IPv4 /24, IPv6 /48 — enough
 *   for spam triage, not a personal address), "full", or "off".
 */
const net = require("net");

const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|mediapartners|facebookexternalhit|facebookcatalog|embedly|quora link preview|outbrain|pinterest\/|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|skypeuripreview|bingpreview|headlesschrome|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|site24x7|datadog|newrelic|curl\/|wget\/|python-requests|python-urllib|aiohttp|httpx|go-http-client|java\/|okhttp|libwww-perl|axios\/|node-fetch|undici|postmanruntime|insomnia/i;

function isBotUserAgent(userAgent) {
  const ua = String(userAgent || "").trim();
  if (!ua) return true; // real browsers always send one
  return BOT_UA.test(ua);
}

function clientIp(req) {
  const ip = String(req.ip || req.socket?.remoteAddress || "").trim();
  return ip.startsWith("::ffff:") && net.isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;
}

function anonymizeIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return ip.split(".").slice(0, 3).concat("0").join(".");
  if (family === 6) {
    const expanded = ip.includes("::")
      ? (() => {
        const [head, tail] = ip.split("::");
        const h = head ? head.split(":") : [];
        const t = tail ? tail.split(":") : [];
        return [...h, ...Array(8 - h.length - t.length).fill("0"), ...t];
      })()
      : ip.split(":");
    return `${expanded.slice(0, 3).join(":")}::`;
  }
  return null;
}

function leadIpForStorage(ip, mode = process.env.MARKETING_LEAD_IP_MODE || "anonymized") {
  if (!ip || mode === "off") return null;
  if (mode === "full") return net.isIP(ip) ? ip : null;
  return anonymizeIp(ip);
}

/** Express middleware: answer tracking calls from bots with 204 and store nothing. */
function dropBotTracking(req, res, next) {
  if (isBotUserAgent(req.headers["user-agent"])) return res.status(204).send();
  return next();
}

module.exports = { isBotUserAgent, clientIp, anonymizeIp, leadIpForStorage, dropBotTracking };
