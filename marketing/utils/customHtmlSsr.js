const sanitizeHtml = require("sanitize-html");
const { parseJsonField } = require("./jsonField");

/**
 * Server-renderable copy of imported custom HTML (SEO): the page body with every script,
 * event handler, script URL, embed and form action removed. Stored on the published section
 * as content.ssr at publish time and rendered into the initial HTML; the browser then mounts
 * the full page (inline, or in the isolated frame for pages with scripts) over it.
 *
 * Always recomputed on publish from content.html, so a content.ssr sent in a draft payload
 * can never reach a live page.
 */
const SSR_VERSION = 1;
const MAX_SSR_BYTES = 500 * 1024;

const SANITIZE_OPTIONS = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img", "picture", "source", "figure", "figcaption", "section", "header", "footer",
    "nav", "main", "article", "aside", "details", "summary", "button", "form", "label",
    "input", "select", "option", "textarea", "fieldset", "legend", "small", "mark", "time",
  ],
  disallowedTagsMode: "discard",
  allowedAttributes: {
    "*": ["class", "id", "style", "title", "role", "lang", "dir", "aria-*", "data-*"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "srcset", "sizes", "alt", "width", "height", "loading"],
    source: ["src", "srcset", "sizes", "type", "media"],
    input: ["type", "name", "value", "placeholder", "required", "checked", "disabled", "min", "max", "step", "pattern", "autocomplete"],
    select: ["name", "required", "disabled", "multiple"],
    option: ["value", "selected", "disabled"],
    textarea: ["name", "placeholder", "required", "rows", "cols"],
    label: ["for"],
    button: ["type", "disabled"],
    form: ["novalidate"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
    time: ["datetime"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"], source: ["http", "https"] },
  allowProtocolRelative: false,
  transformTags: {
    "*": (tagName, attribs) => ({ tagName, attribs: withSafeStyle(attribs) }),
    // target=_blank links never leak the opener.
    a: (tagName, attribs) => {
      const safe = withSafeStyle(attribs);
      return { tagName, attribs: safe.target === "_blank" ? { ...safe, rel: "noopener noreferrer" } : safe };
    },
  },
};

/** Drop inline styles that load resources or smuggle script-like values. */
function withSafeStyle(attribs) {
  if (!attribs.style || !/url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:/i.test(attribs.style)) {
    return attribs;
  }
  const { style: _dropped, ...rest } = attribs;
  return rest;
}

function extractBody(html) {
  const match = html.match(/<body([^>]*)>([\s\S]*?)<\/body\s*>/i);
  if (!match) return { bodyClass: "", body: html };
  const classMatch = match[1].match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  return { bodyClass: (classMatch?.[1] ?? classMatch?.[2] ?? "").trim(), body: match[2] };
}

/** Sanitized body markup for server rendering, or null when there is no text to render. */
function buildCustomHtmlSsr(rawHtml) {
  const html = typeof rawHtml === "string" ? rawHtml : "";
  if (!html.trim() || html.length > 5 * MAX_SSR_BYTES) return null;
  const { bodyClass, body } = extractBody(html);
  const wrapped = `<div data-bb-custom-html-body${bodyClass ? ` class="${bodyClass.replace(/"/g, "")}"` : ""}>${body}</div>`;
  const clean = sanitizeHtml(wrapped, SANITIZE_OPTIONS).trim();
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
  if (!text || clean.length > MAX_SSR_BYTES) return null;
  return { html: clean, version: SSR_VERSION };
}

function isCustomHtmlSection(section) {
  return Boolean(section) && (section.renderType || section.type) === "custom-html";
}

/** Recompute content.ssr for every custom-html section (drops any client-supplied value). */
function attachCustomHtmlSsr(sections) {
  if (!Array.isArray(sections)) return sections;
  return sections.map((section) => {
    if (!isCustomHtmlSection(section)) return section;
    const content = { ...parseJsonField(section.content, {}) };
    delete content.ssr;
    const ssr = buildCustomHtmlSsr(content.html);
    if (ssr) content.ssr = ssr;
    return { ...section, content };
  });
}

module.exports = { buildCustomHtmlSsr, attachCustomHtmlSsr, SSR_VERSION };
