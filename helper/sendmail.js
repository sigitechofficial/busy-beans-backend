const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../.env") });

const axios = require("axios");
const fs = require("fs");

const ZEPTO_URL = "https://api.zeptomail.com/v1.1/email";
const DEFAULT_FROM_NAME = "Busy Bean Coffee";
const DEFAULT_LOCAL_OBSERVER_BCC = "sigidevelopers@gmail.com";

/** BCC on non-production sends so local/staging tests are visible in one inbox. */
function getLocalObserverBccAddress() {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.DISABLE_LOCAL_EMAIL_OBSERVER_BCC === "true") return null;
  const custom = process.env.LOCAL_EMAIL_OBSERVER_BCC;
  if (custom === "false" || custom === "0") return null;
  const trimmed = custom?.trim();
  return trimmed || DEFAULT_LOCAL_OBSERVER_BCC;
}

function collectRecipientAddresses(...fields) {
  const set = new Set();
  for (const field of fields) {
    if (field == null || field === "") continue;
    const arr = Array.isArray(field) ? field : [field];
    for (const item of arr) {
      const raw =
        typeof item === "string"
          ? item
          : item?.address || item?.email || "";
      const address = String(raw).trim().toLowerCase();
      if (address) set.add(address);
    }
  }
  return set;
}

function mergeLocalObserverBcc(bcc, to) {
  const observer = getLocalObserverBccAddress();
  if (!observer) return bcc;
  const existing = collectRecipientAddresses(to, bcc);
  if (existing.has(observer.toLowerCase())) return bcc;
  if (bcc == null || bcc === "") return observer;
  if (Array.isArray(bcc)) return [...bcc, observer];
  return [bcc, observer];
}

const mimeTypes = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".txt": "text/plain",
};

function getMimeType(filename) {
  const ext = path.extname(filename || "").toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

function parseFromOverride(fromOverride) {
  if (!fromOverride || typeof fromOverride !== "string") return null;
  const match = fromOverride.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), address: match[2].trim() };
  const parts = fromOverride.trim().split(/\s+/);
  if (parts.length >= 2)
    return { name: parts[0], address: parts[parts.length - 1] };
  return { name: fromOverride.trim(), address: null };
}

function normalizeToZeptoRecipients(to) {
  const arr = Array.isArray(to) ? to : [to];
  return arr
    .map((item) => {
    if (typeof item === "string") {
      const address = item.trim();
      if (!address) return null;
      return { email_address: { address, name: "" } };
    }
    if (!item || typeof item !== "object") return null;
    const address = (item.address || item.email || "").trim();
    if (!address) return null;
    return {
      email_address: {
        address,
        name: item.name || "",
      },
    };
    })
    .filter(Boolean);
}

async function resolveAttachments(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return { attachments: [], inline_images: [] };
  }
  const zeptoAttachments = [];
  const zeptoInlineImages = [];
  for (const att of attachments) {
    let content;
    if (att.content != null) {
      content = Buffer.isBuffer(att.content)
        ? att.content.toString("base64")
        : Buffer.from(att.content).toString("base64");
    } else if (att.path) {
      content = fs.readFileSync(att.path).toString("base64");
    } else continue;
    const mimeType = att.contentType || getMimeType(att.filename || att.name);
    const name = att.filename || att.name || "attachment";
    if (att.cid) {
      zeptoInlineImages.push({ content, mime_type: mimeType, cid: att.cid });
    } else {
      zeptoAttachments.push({ content, mime_type: mimeType, name });
    }
  }
  return { attachments: zeptoAttachments, inline_images: zeptoInlineImages };
}

/**
 * Send email via ZeptoMail HTTP API (Option A - no SMTP, no TLS).
 * Matches: POST https://api.zeptomail.com/v1.1/email with Authorization: Zoho-enczapikey <token>
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient(s)
 * @param {string} options.subject - Subject line
 * @param {string} options.html - HTML body
 * @param {Array} [options.attachments] - Optional; items: path, filename, cid, content
 * @param {string|string[]} [options.bcc] - BCC (optional)
 * @param {string|string[]} [options.cc] - CC (optional)
 * @param {string} [options.replyTo] - Reply-To (optional)
 * @param {string} [options.text] - Plain text body (optional; used when html is missing)
 * @param {string} [options.name] - From name (optional)
 * @param {string} [options.from] - Full From override (optional)
 * @param {Function} [callback] - (err, info); if omitted, returns Promise
 * @returns {Promise|void}
 */
async function sendMail(options, callback) {
  const {
    to,
    subject,
    html,
    text,
    attachments = [],
    bcc,
    cc,
    replyTo,
    name,
    from: fromOverride,
  } = options;

  const rawToken =
    process.env.EMAIL_PASSWORD || process.env.ZEPTO_API_TOKEN || "";
  const fromEmail =
    process.env.EMAIL_USERNAME_FOR_CUSTOMER ||
    process.env.FROM_EMAIL ||
    process.env.EMAIL_USERNAME?.replace(/^[^<]*<([^>]+)>$/, "$1").trim() ||
    "noreply@busybeancoffee.com";

  if (!rawToken || !fromEmail) {
    const err = new Error(
      "sendMail: Set EMAIL_PASSWORD (or ZEPTO_API_TOKEN) and EMAIL_USERNAME_FOR_CUSTOMER in .env",
    );
    if (typeof callback === "function") return callback(err);
    throw err;
  }

  // Header exactly as API tab: "Zoho-enczapikey <token>" (token can include or omit prefix)
  const authValue = /^zoho-enczapikey\s+/i.test(rawToken.trim())
    ? rawToken.trim()
    : `Zoho-enczapikey ${rawToken.trim()}`;

  let fromName = process.env.ZEPTO_FROM_NAME || DEFAULT_FROM_NAME;
  let fromAddress = fromEmail;
  if (fromOverride) {
    const parsed = parseFromOverride(fromOverride);
    if (parsed) {
      fromName = parsed.name;
      if (parsed.address) fromAddress = parsed.address;
    } else {
      fromName = fromOverride;
    }
  } else if (name !== undefined && name !== "") {
    fromName = name;
  }

  const payload = {
    from: { address: fromAddress, name: fromName },
    to: normalizeToZeptoRecipients(to),
    subject,
  };
  if (!payload.to.length) {
    throw new Error("sendMail: Missing valid recipient email in `to` field");
  }
  if (html != null && html !== "") {
    payload.htmlbody = html;
  }
  if (text != null && text !== "") {
    payload.textbody = text;
  }
  if (!payload.htmlbody && !payload.textbody) {
    payload.htmlbody = "";
  }

  const effectiveBcc = mergeLocalObserverBcc(bcc, to);
  if (
    effectiveBcc != null &&
    (Array.isArray(effectiveBcc) ? effectiveBcc.length > 0 : effectiveBcc)
  ) {
    payload.bcc = normalizeToZeptoRecipients(effectiveBcc);
  }
  if (cc != null && (Array.isArray(cc) ? cc.length > 0 : cc)) {
    payload.cc = normalizeToZeptoRecipients(cc);
  }
  if (replyTo) {
    const addr = typeof replyTo === "string" ? replyTo : replyTo?.address;
    if (addr) {
      payload.reply_to = [{ address: addr, name: "" }];
    }
  }

  const { attachments: attList, inline_images: inlineList } =
    await resolveAttachments(attachments);
  if (attList.length > 0) payload.attachments = attList;
  if (inlineList.length > 0) payload.inline_images = inlineList;

  const run = async () => {
    try {
      const res = await axios.post(ZEPTO_URL, payload, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: authValue,
        },
        timeout: 15000,
      });
      console.log("[sendMail] Email sent successfully", {
        to: payload.to,
        bcc: payload.bcc,
        subject: payload.subject,
      });
      return res.data;
    } catch (err) {
      if (err.response?.data) {
        const d = err.response.data;
        const msg =
          d?.error?.message ??
          d?.message ??
          (typeof d === "object" ? JSON.stringify(d) : d);
        const details = d?.error?.details;
        const ipBlocked = Array.isArray(details)
          ? details.some((x) => x?.code === "SERR_156")
          : false;
        if (ipBlocked) {
          console.error(
            "[sendMail] ZeptoMail blocked this request: your public IP is not on the Zepto Mail allowlist (SERR_156). Add it in Zoho ZeptoMail → Mail Agents → IP restrictions. No email is delivered to To or BCC until fixed.",
          );
        }
        console.error("[sendMail] ZeptoMail", err.response.status, msg);
      }
      throw err;
    }
  };

  if (typeof callback === "function") {
    return run()
      .then((data) => callback(null, data))
      .catch((err) => callback(err));
  }
  return run();
}

module.exports = { sendMail };
