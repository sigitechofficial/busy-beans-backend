const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const ZEPTO_URL = "https://api.zeptomail.com/v1.1/email";
const DEFAULT_FROM_NAME = "Busy Bean Coffee";

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
  return arr.map((item) => {
    if (typeof item === "string") {
      return { email_address: { address: item, name: "" } };
    }
    return {
      email_address: {
        address: item.address || item.email,
        name: item.name || "",
      },
    };
  });
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
  if (html != null && html !== "") {
    payload.htmlbody = html;
  }
  if (text != null && text !== "") {
    payload.textbody = text;
  }
  if (!payload.htmlbody && !payload.textbody) {
    payload.htmlbody = "";
  }

  if (bcc != null && (Array.isArray(bcc) ? bcc.length > 0 : bcc)) {
    payload.bcc = normalizeToZeptoRecipients(bcc);
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
