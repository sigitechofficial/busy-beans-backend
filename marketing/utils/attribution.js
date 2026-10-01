/**
 * Server-side attribution normalizer / validator / classifier (spec Phase 3).
 *
 * The browser's attribution is a claim. For every touch the server:
 *   1. validates types and lengths, keeps only known properties (+ sanitized unknown utm_*),
 *   2. re-parses UTMs / click IDs / campaign metadata from the RAW landing URL when available,
 *   3. re-classifies the channel with the canonical taxonomy (same rules as the website's
 *      lib/analytics/client/channelClassifier.ts — keep both in sync),
 *   4. redacts personal-data-looking URL parameters.
 * Attribution is reporting metadata only — never used for authorization or business logic.
 */

const LIMITS = {
  source: 100,
  medium: 100,
  channel: 100,
  campaign: 255,
  content: 255,
  term: 500,
  clickId: 512,
  url: 2048,
  domain: 255,
  generic: 255,
  extraKeys: 20,
};

const CHANNELS = [
  "Direct",
  "Organic Search",
  "Paid Search",
  "Organic Social",
  "Paid Social",
  "Email",
  "Referral",
  "Affiliate",
  "Partner",
  "Display",
  "Video",
  "WhatsApp",
  "SMS",
  "QR",
  "Offline",
  "Other",
];

const UTM_FIELDS = {
  utm_source: ["source", LIMITS.source],
  utm_medium: ["medium", LIMITS.medium],
  utm_campaign: ["campaign", LIMITS.campaign],
  utm_content: ["content", LIMITS.content],
  utm_term: ["term", LIMITS.term],
  utm_id: ["utmId", LIMITS.generic],
  utm_source_platform: ["sourcePlatform", LIMITS.generic],
  utm_creative_format: ["creativeFormat", LIMITS.generic],
  utm_marketing_tactic: ["marketingTactic", LIMITS.generic],
};

/** URL parameter (lower-case) → click-ID key. */
const CLICK_ID_PARAMS = {
  gclid: "gclid",
  gbraid: "gbraid",
  wbraid: "wbraid",
  dclid: "dclid",
  fbclid: "fbclid",
  msclkid: "msclkid",
  ttclid: "ttclid",
  li_fat_id: "liFatId",
  twclid: "twclid",
  sccid: "scCid",
  epik: "epik",
  rdt_cid: "rdtCid",
};
const CLICK_ID_KEYS = Object.values(CLICK_ID_PARAMS);

const META_PARAMS = {
  campaign_id: "campaignId",
  campaign_name: "campaignName",
  ad_group_id: "adGroupId",
  adgroup_id: "adGroupId",
  adgroupid: "adGroupId",
  ad_group_name: "adGroupName",
  adgroup_name: "adGroupName",
  adset_id: "adsetId",
  adset_name: "adsetName",
  ad_id: "adId",
  ad_name: "adName",
  creative_id: "creativeId",
  placement: "placement",
  network: "network",
  device: "device",
  match_type: "matchType",
  matchtype: "matchType",
  keyword: "keyword",
  affiliate_id: "affiliateId",
  partner_id: "partnerId",
};
const META_KEYS = [...new Set(Object.values(META_PARAMS))];

const PII_PARAM = /^(e-?mail|email_?address|mail|phone|tel|telephone|mobile|name|first_?name|last_?name|full_?name|fname|lname|address|street|zip|zipcode|postcode|postal_?code|company|message)$/i;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

// ── validation helpers ──────────────────────────────────────────────────────

/** Trimmed string without control characters, capped; anything else → undefined. */
function str(value, max) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  // eslint-disable-next-line no-control-regex
  const cleaned = String(value).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function noEmail(value) {
  return value && EMAIL_LIKE.test(value) ? "[redacted]" : value;
}

/** http(s) URL with personal-data-looking parameters redacted; anything else → undefined. */
function cleanUrl(value) {
  const raw = str(value, LIMITS.url * 2);
  if (!raw) return undefined;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  for (const [key, val] of [...url.searchParams.entries()]) {
    if (PII_PARAM.test(key) || EMAIL_LIKE.test(val)) url.searchParams.set(key, "[redacted]");
  }
  return url.toString().slice(0, LIMITS.url);
}

function cleanQuery(query) {
  if (!query) return undefined;
  const url = cleanUrl(`https://q.invalid/?${String(query).replace(/^\?/, "")}`);
  const out = url ? url.replace(/^https:\/\/q\.invalid\/\??/, "") : "";
  return out ? out.slice(0, LIMITS.url) : undefined;
}

/** ISO timestamp within [now - 2 years, now + 5 min]; otherwise undefined (never trusted blindly). */
function cleanTimestamp(value, now = Date.now()) {
  const s = str(value, 40);
  if (!s) return undefined;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return undefined;
  if (t > now + 5 * 60 * 1000 || t < now - 2 * 365 * 24 * 3600 * 1000) return undefined;
  return new Date(t).toISOString();
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

const SHARED_SUFFIXES = ["vercel.app", "netlify.app", "herokuapp.com", "amplifyapp.com", "github.io", "pages.dev", "web.app"];
const PASS_THROUGH_HOSTS = [/(^|\.)stripe\.com$/i, /(^|\.)paypal\.com$/i, /^accounts\.google\.com$/i, /^appleid\.apple\.com$/i, /^login\.microsoftonline\.com$/i, /^login\.live\.com$/i];

function siteKey(host) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  if (SHARED_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`))) return h;
  const parts = h.split(".");
  const twoLevel = parts.length > 2 && parts[parts.length - 1].length === 2 && /^(co|com|org|net|gov|ac|edu)$/.test(parts[parts.length - 2]);
  const keep = twoLevel ? 3 : 2;
  return parts.length > keep ? parts.slice(-keep).join(".") : h;
}

function isPrivateHost(host) {
  return host === "localhost" || host.endsWith(".localhost") || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

/** External referrer (URL + domain) relative to the landing page host; internal → { external: false }. */
function referrerInfo(referrer, landingHost) {
  const url = cleanUrl(referrer);
  if (!url) return { external: false };
  const host = hostOf(url);
  if (!host) return { external: false };
  const current = String(landingHost || "").toLowerCase().replace(/^www\./, "");
  const internal =
    isPrivateHost(host) ||
    (current && (host === current || siteKey(host) === siteKey(current))) ||
    PASS_THROUGH_HOSTS.some((re) => re.test(host));
  return internal ? { external: false, domain: host } : { external: true, url, domain: host.slice(0, LIMITS.domain) };
}

// ── parsing ─────────────────────────────────────────────────────────────────

function parseCampaign(landingUrl) {
  const out = { utm: {}, extraUtm: {}, clickIds: {}, meta: {}, rawQuery: undefined };
  let url;
  try {
    url = new URL(landingUrl);
  } catch {
    return out;
  }
  out.rawQuery = cleanQuery(url.search);
  for (const [rawKey, rawValue] of url.searchParams.entries()) {
    const key = rawKey.toLowerCase();
    if (UTM_FIELDS[key]) {
      const [field, max] = UTM_FIELDS[key];
      const value = noEmail(str(rawValue, max));
      if (value && !out.utm[field]) out.utm[field] = value;
    } else if (key.startsWith("utm_")) {
      const value = noEmail(str(rawValue, LIMITS.generic));
      const safeKey = key.replace(/[^a-z0-9_]/g, "").slice(0, 64);
      if (value && safeKey && Object.keys(out.extraUtm).length < LIMITS.extraKeys) out.extraUtm[safeKey] = value;
    } else if (CLICK_ID_PARAMS[key]) {
      const value = str(rawValue, LIMITS.clickId);
      if (value && !out.clickIds[CLICK_ID_PARAMS[key]]) out.clickIds[CLICK_ID_PARAMS[key]] = value;
    } else if (META_PARAMS[key]) {
      const value = noEmail(str(rawValue, LIMITS.generic));
      if (value && !out.meta[META_PARAMS[key]]) out.meta[META_PARAMS[key]] = value;
    }
  }
  return out;
}

// ── classification (mirror of the website classifier) ────────────────────────

const MEDIUM_CHANNELS = {};
function aliases(channel, values) {
  for (const v of values) MEDIUM_CHANNELS[v] = channel;
}
aliases("Paid Search", ["cpc", "ppc", "paid_search", "paidsearch", "search_paid", "sem", "paid_search_ads", "search_ads", "adwords", "google_ads", "bing_ads"]);
aliases("Paid Social", ["paid_social", "paidsocial", "social_paid", "socialpaid", "social_ads", "social_ad", "paid_social_ads", "facebook_ads", "fb_ads", "meta_ads", "fb_paid", "ppc_facebook", "cpc_social", "ppc_social", "social_cpc"]);
aliases("Display", ["display", "banner", "cpm", "gdn", "programmatic", "display_ads", "native"]);
aliases("Video", ["video", "video_ads", "youtube_ads", "ctv", "ott"]);
aliases("Email", ["email", "e_mail", "mail", "newsletter", "emailmarketing", "email_marketing", "cold_outreach", "nurture", "customer_email"]);
aliases("Organic Social", ["social", "organic_social", "social_organic", "social_media", "socialmedia", "sm"]);
aliases("Organic Search", ["organic", "organic_search", "seo"]);
aliases("Referral", ["referral", "referal", "referrer"]);
aliases("Affiliate", ["affiliate", "affiliates"]);
aliases("Partner", ["partner", "partners", "partnership"]);
aliases("SMS", ["sms", "text", "text_message", "mms"]);
aliases("WhatsApp", ["whatsapp", "whats_app", "wa"]);
aliases("QR", ["qr", "qr_code", "qrcode"]);
aliases("Offline", ["offline", "print", "event", "events", "tradeshow", "trade_show", "expo", "direct_mail", "brochure", "flyer", "billboard", "radio", "tv", "ooh", "outdoor"]);
aliases("Direct", ["none", "(none)", "direct"]);

const GENERIC_PAID = new Set(["paid", "ads", "ad", "paid_ads", "paidads", "advertising"]);
const SEARCH_SOURCES = ["google", "bing", "yahoo", "duckduckgo", "baidu", "yandex", "ecosia", "brave", "ask", "aol", "naver"];
const SOCIAL_SOURCES = ["facebook", "fb", "instagram", "ig", "linkedin", "tiktok", "youtube", "x", "twitter", "pinterest", "reddit", "snapchat", "threads", "nextdoor", "quora", "messenger", "meta"];
const EMAIL_SOURCES = ["newsletter", "email", "mailchimp", "klaviyo", "sendgrid", "gmail", "outlook", "constantcontact", "brevo"];

function sourceIs(source, list) {
  return list.some((s) => source === s || source.startsWith(`${s}_`) || source.startsWith(`${s}.`) || source.endsWith(`_${s}`));
}

function channelFromSource(source) {
  if (!source) return undefined;
  if (sourceIs(source, ["whatsapp", "wa"])) return "WhatsApp";
  if (sourceIs(source, ["sms", "twilio"])) return "SMS";
  if (sourceIs(source, ["qr"])) return "QR";
  if (sourceIs(source, EMAIL_SOURCES)) return "Email";
  if (sourceIs(source, SOCIAL_SOURCES)) return "Organic Social";
  if (sourceIs(source, SEARCH_SOURCES)) return "Organic Search";
  return undefined;
}

const HOST_RULES = [
  [/^(chat\.openai\.com|chatgpt\.com)$/i, "chatgpt", "Referral"],
  [/(^|\.)perplexity\.ai$/i, "perplexity", "Referral"],
  [/^gemini\.google\.com$/i, "gemini", "Referral"],
  [/^copilot\.microsoft\.com$/i, "copilot", "Referral"],
  [/^claude\.ai$/i, "claude", "Referral"],
  [/^mail\.google\.com$|(^|\.)outlook\.(live|office|office365)\.com$|^mail\.yahoo\.com$/i, "email", "Email"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|^fb\.me$|^m\.me$/i, "facebook", "Organic Social"],
  [/(^|\.)instagram\.com$/i, "instagram", "Organic Social"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/i, "linkedin", "Organic Social"],
  [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/i, "x", "Organic Social"],
  [/(^|\.)tiktok\.com$/i, "tiktok", "Organic Social"],
  [/(^|\.)snapchat\.com$/i, "snapchat", "Organic Social"],
  [/(^|\.)pinterest\.[a-z.]+$|^pin\.it$/i, "pinterest", "Organic Social"],
  [/(^|\.)reddit\.com$/i, "reddit", "Organic Social"],
  [/(^|\.)youtube\.com$|^youtu\.be$/i, "youtube", "Organic Social"],
  [/(^|\.)nextdoor\.com$/i, "nextdoor", "Organic Social"],
  [/(^|\.)threads\.net$/i, "threads", "Organic Social"],
  [/(^|\.)whatsapp\.com$|^wa\.me$/i, "whatsapp", "WhatsApp"],
  [/(^|\.)google\.[a-z.]+$/i, "google", "Organic Search"],
  [/(^|\.)bing\.com$/i, "bing", "Organic Search"],
  [/(^|\.)yahoo\.[a-z.]+$/i, "yahoo", "Organic Search"],
  [/(^|\.)duckduckgo\.com$/i, "duckduckgo", "Organic Search"],
  [/(^|\.)ecosia\.org$/i, "ecosia", "Organic Search"],
  [/^search\.brave\.com$/i, "brave", "Organic Search"],
  [/(^|\.)yandex\.[a-z.]+$/i, "yandex", "Organic Search"],
  [/(^|\.)baidu\.com$/i, "baidu", "Organic Search"],
  [/(^|\.)naver\.com$/i, "naver", "Organic Search"],
];

function knownReferrer(domain) {
  if (!domain) return null;
  for (const [re, source, channel] of HOST_RULES) if (re.test(domain)) return { source, channel };
  return null;
}

const CLICK_PLATFORM = {
  gclid: "google",
  gbraid: "google",
  wbraid: "google",
  dclid: "google",
  msclkid: "microsoft",
  fbclid: "meta",
  ttclid: "tiktok",
  liFatId: "linkedin",
  twclid: "x",
  scCid: "snapchat",
  epik: "pinterest",
  rdtCid: "reddit",
};
const SOURCE_PLATFORM = [
  ["google", ["google", "youtube", "gdn", "googleads", "adwords", "pmax", "dv360"]],
  ["microsoft", ["bing", "microsoft", "msn"]],
  ["meta", ["facebook", "fb", "instagram", "ig", "meta", "messenger"]],
  ["tiktok", ["tiktok"]],
  ["linkedin", ["linkedin"]],
  ["x", ["x", "twitter"]],
  ["snapchat", ["snapchat"]],
  ["pinterest", ["pinterest"]],
  ["reddit", ["reddit"]],
];

function sourcePlatform(source) {
  for (const [platform, names] of SOURCE_PLATFORM) if (sourceIs(source, names)) return platform;
  return undefined;
}

function clickIdTouch(ids, referrerDomain) {
  if (ids.gclid || ids.gbraid || ids.wbraid) return { source: "google", channel: "Paid Search", medium: "cpc" };
  if (ids.msclkid) return { source: "bing", channel: "Paid Search", medium: "cpc" };
  if (ids.dclid) return { source: "google", channel: "Display", medium: "display" };
  if (ids.ttclid) return { source: "tiktok", channel: "Paid Social", medium: "paid_social" };
  if (ids.liFatId) return { source: "linkedin", channel: "Paid Social", medium: "paid_social" };
  if (ids.twclid) return { source: "x", channel: "Paid Social", medium: "paid_social" };
  if (ids.scCid) return { source: "snapchat", channel: "Paid Social", medium: "paid_social" };
  if (ids.epik) return { source: "pinterest", channel: "Paid Social", medium: "paid_social" };
  if (ids.rdtCid) return { source: "reddit", channel: "Paid Social", medium: "paid_social" };
  if (ids.fbclid) {
    const known = knownReferrer(referrerDomain);
    return { source: known && known.channel === "Organic Social" ? known.source : "facebook", channel: "Organic Social", medium: "organic_social" };
  }
  return null;
}

function inferredMedium(channel) {
  const map = {
    "Organic Search": "organic",
    "Organic Social": "organic_social",
    Referral: "referral",
    Email: "email",
    WhatsApp: "whatsapp",
    SMS: "sms",
    QR: "qr",
    Direct: "none",
  };
  return map[channel] || channel.toLowerCase().replace(/\s+/g, "_");
}

function classifyTouch({ utm = {}, clickIds = {}, meta = {}, referrer = { external: false } }) {
  const utmSource = String(utm.source || "").trim().toLowerCase();
  const utmMedium = String(utm.medium || "").trim().toLowerCase();
  const token = utmMedium.replace(/[\s-]+/g, "_");
  const external = referrer.external ? referrer.domain : undefined;
  const known = knownReferrer(external);
  const click = clickIdTouch(clickIds, external);
  let channel;
  let source;
  let medium;
  if (utmMedium) {
    if (MEDIUM_CHANNELS[token]) channel = MEDIUM_CHANNELS[token];
    else if (GENERIC_PAID.has(token) || /(^|_)(cpc|ppc|paid)(_|$)/.test(token)) {
      channel = sourceIs(utmSource, SOCIAL_SOURCES) || /social/.test(token) ? "Paid Social" : "Paid Search";
    } else channel = "Other";
    if ((token === "cpc" || token === "ppc") && sourceIs(utmSource, SOCIAL_SOURCES) && !sourceIs(utmSource, ["youtube"])) channel = "Paid Social";
    source = utmSource || click?.source || known?.source || external || "direct";
    medium = utmMedium;
  } else if (utmSource) {
    channel = click?.channel || channelFromSource(utmSource) || "Other";
    source = utmSource;
    medium = click?.medium || inferredMedium(channel);
  } else if (click) {
    ({ channel, source, medium } = click);
  } else if (meta.affiliateId) {
    channel = "Affiliate";
    source = external || "affiliate";
    medium = "affiliate";
  } else if (meta.partnerId) {
    channel = "Partner";
    source = external || "partner";
    medium = "partner";
  } else if (external) {
    channel = known?.channel || "Referral";
    source = known?.source || external;
    medium = inferredMedium(channel);
  } else {
    channel = "Direct";
    source = "direct";
    medium = "none";
  }
  const clickPlatforms = new Set(Object.keys(clickIds).filter((k) => clickIds[k]).map((k) => CLICK_PLATFORM[k]));
  const utmPlatform = sourcePlatform(utmSource);
  const paidClick = Boolean(click && click.channel !== "Organic Social");
  const conflict =
    (Boolean(utmPlatform) && clickPlatforms.size > 0 && !clickPlatforms.has(utmPlatform)) ||
    (Boolean(utmMedium) && paidClick && ["Organic Search", "Organic Social", "Referral", "Direct"].includes(channel));
  return { channel, source: source.slice(0, LIMITS.source), medium: medium.slice(0, LIMITS.medium), conflict };
}

/** Legacy category key for older reports / Campaign Builder labels. */
function channelToCategory(channel) {
  const map = { "Paid Search": "paid_search", "Paid Social": "paid_social", "Organic Search": "organic_search", "Organic Social": "social" };
  return map[channel] || String(channel || "direct").toLowerCase().replace(/\s+/g, "_");
}

const LEGACY_CATEGORY_CHANNEL = {
  paid_search: "Paid Search",
  paid_social: "Paid Social",
  organic_search: "Organic Search",
  social: "Organic Social",
  email: "Email",
  referral: "Referral",
  direct: "Direct",
  qr: "QR",
  ai_assistant: "Referral",
  affiliate: "Affiliate",
  partner: "Partner",
  display: "Display",
  video: "Video",
  whatsapp: "WhatsApp",
  sms: "SMS",
  offline: "Offline",
  other: "Other",
};

// ── touches ─────────────────────────────────────────────────────────────────

function cleanClickIds(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const key of CLICK_ID_KEYS) {
    const v = value[key];
    const clean = str(typeof v === "object" && v ? v.value : v, LIMITS.clickId);
    if (clean) out[key] = clean;
  }
  return out;
}

function cleanMeta(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const key of META_KEYS) {
    const v = noEmail(str(value[key], LIMITS.generic));
    if (v) out[key] = v;
  }
  return out;
}

function cleanExtraUtm(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [rawKey, rawVal] of Object.entries(value)) {
    if (Object.keys(out).length >= LIMITS.extraKeys) break;
    const key = String(rawKey).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 64);
    const val = noEmail(str(rawVal, LIMITS.generic));
    if (key.startsWith("utm_") && val) out[key] = val;
  }
  return out;
}

function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Normalize a client touch. With a valid landingUrl, UTMs / click IDs / metadata are re-parsed
 * from it (the raw URL is the evidence); otherwise the client's fields are sanitized. The channel
 * is always re-classified here.
 */
function normalizeTouch(input, { now = Date.now() } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const landingUrl = cleanUrl(input.landingUrl);
  const landingHost = landingUrl ? hostOf(landingUrl) : "";
  const referrer = referrerInfo(input.referrer, landingHost);
  let utm;
  let clickIds;
  let meta;
  let extraUtm;
  let rawQuery;
  if (landingUrl) {
    const parsed = parseCampaign(landingUrl);
    ({ utm, clickIds, meta, extraUtm, rawQuery } = parsed);
  } else {
    utm = compact({
      source: noEmail(str(input.source, LIMITS.source)),
      medium: noEmail(str(input.medium, LIMITS.medium)),
      campaign: noEmail(str(input.campaign, LIMITS.campaign)),
      content: noEmail(str(input.content, LIMITS.content)),
      term: noEmail(str(input.term, LIMITS.term)),
      utmId: str(input.utmId, LIMITS.generic),
      sourcePlatform: str(input.sourcePlatform, LIMITS.generic),
      creativeFormat: str(input.creativeFormat, LIMITS.generic),
      marketingTactic: str(input.marketingTactic, LIMITS.generic),
    });
    clickIds = cleanClickIds(input.clickIds);
    meta = cleanMeta(input.meta);
    extraUtm = cleanExtraUtm(input.extraUtm);
    rawQuery = cleanQuery(input.rawQuery);
  }
  // A client without a raw URL sent a direct touch (no source): keep it direct, not "Other".
  const direct = !landingUrl && (!utm.source || utm.source === "direct") && Object.keys(clickIds).length === 0 && !referrer.external;
  const c = direct
    ? { channel: "Direct", source: "direct", medium: "none", conflict: false }
    : classifyTouch({ utm: landingUrl || utm.medium ? utm : { source: utm.source }, clickIds, meta, referrer });
  let landingPage = str(input.landingPage, LIMITS.url);
  if (landingUrl) {
    try {
      landingPage = new URL(landingUrl).pathname.slice(0, LIMITS.url);
    } catch {
      /* keep */
    }
  }
  if (landingPage && !landingPage.startsWith("/")) landingPage = undefined;
  return compact({
    channel: c.channel,
    source: c.source,
    medium: c.medium,
    campaign: utm.campaign,
    content: utm.content,
    term: utm.term,
    utmId: utm.utmId,
    sourcePlatform: utm.sourcePlatform,
    creativeFormat: utm.creativeFormat,
    marketingTactic: utm.marketingTactic,
    meta,
    extraUtm,
    referrer: referrer.external ? referrer.url : undefined,
    referrerDomain: referrer.external ? referrer.domain : undefined,
    landingPage,
    landingUrl,
    rawQuery,
    clickIds,
    conflict: c.conflict || undefined,
    timestamp: cleanTimestamp(input.timestamp, now),
  });
}

/** Legacy flat attribution (old website / Campaign Builder payloads) → a touch. */
function touchFromLegacy({ source, medium, campaign, content, term, referrer, category, clickIds } = {}) {
  const s = str(source, LIMITS.source);
  if (!s) return null;
  const m = str(medium, LIMITS.medium);
  const ids = cleanClickIds(clickIds);
  let channel = LEGACY_CATEGORY_CHANNEL[String(category || "").toLowerCase()];
  if (!channel) {
    channel = s.toLowerCase() === "direct" ? "Direct" : classifyTouch({ utm: { source: s, medium: m }, clickIds: ids }).channel;
  }
  const ref = cleanUrl(referrer);
  return compact({
    channel,
    source: s.toLowerCase(),
    medium: (m || inferredMedium(channel)).toLowerCase(),
    campaign: noEmail(str(campaign, LIMITS.campaign)),
    content: noEmail(str(content, LIMITS.content)),
    term: noEmail(str(term, LIMITS.term)),
    referrer: ref,
    referrerDomain: ref ? hostOf(ref) : undefined,
    clickIds: ids,
  });
}

/** Click IDs with timestamps ({ gclid: { value, at } }), whitelisted. */
function cleanClickIdRecords(value, now = Date.now()) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const key of CLICK_ID_KEYS) {
    const v = value[key];
    if (v === undefined || v === null) continue;
    const record = typeof v === "object" ? v : { value: v };
    const clean = str(record.value, LIMITS.clickId);
    if (!clean) continue;
    out[key] = compact({ value: clean, at: cleanTimestamp(record.at, now) });
  }
  return out;
}

module.exports = {
  LIMITS,
  CHANNELS,
  CLICK_ID_KEYS,
  str,
  cleanUrl,
  cleanQuery,
  cleanTimestamp,
  hostOf,
  referrerInfo,
  parseCampaign,
  classifyTouch,
  channelToCategory,
  normalizeTouch,
  touchFromLegacy,
  cleanClickIds,
  cleanClickIdRecords,
  compact,
};
