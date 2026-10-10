/**
 * Tracking tags & scripts (Phase 13): one validated shape for the global settings and a page's
 * own tracking. The website loads these tags, so IDs must match the vendor's format exactly (an
 * ID is inserted into the tag snippet — no free text). Custom header/body/footer scripts are
 * arbitrary HTML and may only be changed by Super Admins (see middlewares/customHtmlGuard.js).
 */
const ID_FIELDS = {
  ga4MeasurementId: { re: /^G-[A-Z0-9]{4,16}$/, label: "GA4 measurement ID (G-XXXXXXX)", upper: true },
  googleTagManagerId: { re: /^GTM-[A-Z0-9]{4,12}$/, label: "Google Tag Manager ID (GTM-XXXXXX)", upper: true },
  googleAdsId: { re: /^AW-\d{6,14}$/, label: "Google Ads tag ID (AW-XXXXXXXXX)", upper: true },
  googleAdsLeadLabel: { re: /^[A-Za-z0-9_-]{4,40}$/, label: "Google Ads lead conversion label" },
  metaPixelId: { re: /^\d{6,20}$/, label: "Meta Pixel ID (digits)" },
  linkedInInsightTagId: { re: /^\d{3,12}$/, label: "LinkedIn partner ID (digits)" },
  linkedInLeadConversionId: { re: /^\d{3,14}$/, label: "LinkedIn lead conversion ID (digits)" },
  tiktokPixelId: { re: /^[A-Z0-9]{10,30}$/, label: "TikTok Pixel ID", upper: true },
  snapchatPixelId: {
    re: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    label: "Snapchat Pixel ID (UUID)",
    lower: true,
  },
  xPixelId: { re: /^[a-z0-9]{4,12}$/, label: "X (Twitter) Pixel ID", lower: true },
  microsoftUetTagId: { re: /^\d{5,12}$/, label: "Microsoft Ads UET tag ID (digits)" },
  xLeadEventId: { re: /^tw-[a-z0-9]{4,12}-[a-z0-9]{4,12}$/, label: "X lead event ID (tw-xxxxx-xxxxx)", lower: true },
  xPurchaseEventId: { re: /^tw-[a-z0-9]{4,12}-[a-z0-9]{4,12}$/, label: "X purchase event ID (tw-xxxxx-xxxxx)", lower: true },
};

/**
 * Cookie consent (website banner). consentMode: "auto" = ask first in the EU/EEA, UK and
 * Switzerland, notice with opt-out elsewhere; "opt_in" = ask everyone first; "opt_out" = notice
 * everywhere. consentModeAdvanced: load Google tags before consent (Consent Mode "advanced":
 * cookieless pings) instead of waiting for it ("basic").
 */
const CONSENT_MODES = ["auto", "opt_in", "opt_out"];

const SCRIPT_FIELDS = ["headerScript", "bodyScript", "footerScript"];
const MAX_SCRIPT_CHARS = 20000;

/**
 * Seed/demo values that look valid but belong to nobody (or to someone else): never load them.
 * e.g. G-XXXXXXXX, GTM-XXXXXX, 123456789, 000000, 1111111.
 */
function isPlaceholder(value) {
  const body = String(value).toUpperCase().replace(/^(G|GTM|AW)-/, "");
  if (/^X+$/.test(body)) return true;
  if (/^(\d)\1+$/.test(body)) return true;
  if (/^0*1234567890?$/.test(body) || body === "12345678") return true;
  return false;
}

/** Repairs a value saved as a JSON string spread into {"0":"{","1":"\"",...} by an old bug. */
function repairCharMap(src) {
  const keys = Object.keys(src);
  const isCharMap = keys.length > 0 && keys.every((k) => /^\d+$/.test(k) && typeof src[k] === "string" && src[k].length === 1);
  if (!isCharMap) return src;
  try {
    const text = keys
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => src[k])
      .join("");
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") return toSettingsObject(parsed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Settings as a plain object. Older saves stored the object as a JSON string, sometimes encoded
 * several times over, or spread into a char map — unwrap all of those.
 */
function toSettingsObject(value) {
  let src = value;
  for (let depth = 0; depth < 8; depth += 1) {
    if (typeof src === "string") {
      try {
        src = JSON.parse(src);
      } catch {
        return {};
      }
      continue;
    }
    if (src && typeof src === "object" && !Array.isArray(src)) {
      const repaired = repairCharMap(src);
      if (repaired === src) return src;
      src = repaired;
      continue;
    }
    return {};
  }
  return {};
}

function validationError(message, field) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  error.field = field;
  return error;
}

/**
 * Normalize tracking settings. Unknown keys are dropped; empty strings and placeholder IDs
 * clear a field. Throws VALIDATION_ERROR for an ID in the wrong format.
 */
function normalizeTrackingSettings(input) {
  const src = toSettingsObject(input);
  const out = { captureUtmFields: src.captureUtmFields !== false };
  if (src.consentMode !== undefined && src.consentMode !== null && src.consentMode !== "") {
    if (!CONSENT_MODES.includes(src.consentMode)) throw validationError("Invalid consent mode.", "consentMode");
    out.consentMode = src.consentMode;
  }
  if (src.consentModeAdvanced === true) out.consentModeAdvanced = true;
  for (const [field, rule] of Object.entries(ID_FIELDS)) {
    if (src[field] === undefined || src[field] === null) continue;
    let value = String(src[field]).trim();
    if (!value) continue;
    if (rule.upper) value = value.toUpperCase();
    if (rule.lower) value = value.toLowerCase();
    if (!rule.re.test(value)) throw validationError(`Invalid ${rule.label}.`, field);
    if (isPlaceholder(value)) continue;
    out[field] = value;
  }
  for (const field of SCRIPT_FIELDS) {
    if (src[field] === undefined || src[field] === null) continue;
    const value = String(src[field]);
    if (value.length > MAX_SCRIPT_CHARS) {
      throw validationError(`${field} is longer than ${MAX_SCRIPT_CHARS} characters.`, field);
    }
    if (value.trim()) out[field] = value;
  }
  return out;
}

/** True when any custom script differs between two settings objects. */
function scriptsChanged(before, after) {
  const a = normalizeScripts(before);
  const b = normalizeScripts(after);
  return SCRIPT_FIELDS.some((f) => a[f] !== b[f]);
}

function normalizeScripts(value) {
  const src = toSettingsObject(value);
  return Object.fromEntries(SCRIPT_FIELDS.map((f) => [f, String(src[f] || "").trim()]));
}

module.exports = { CONSENT_MODES, normalizeTrackingSettings, scriptsChanged, isPlaceholder, toSettingsObject, ID_FIELDS, SCRIPT_FIELDS };
