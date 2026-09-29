const catchAsync = require("../../utils/catchAsync");
const { getMarketingUserModel } = require("../models/marketingUser");
const { getLandingPageModel } = require("../models/landingPage");
const { parseJsonField } = require("../utils/jsonField");
const { sendError } = require("../utils/httpResponses");
const { scriptsChanged } = require("../utils/trackingSettings");

/**
 * Custom HTML sections run the author's own JavaScript (in an isolated frame on public
 * pages), so only Super Admins may add or change them. Enforced here on the API — the
 * builder's `superAdminOnly` flag is UI only.
 *
 * Landing pages: blocked only when the request adds a custom-html section or changes its
 * HTML; editing other sections of a page that already has custom HTML stays allowed.
 * Templates: any custom-html section requires a Super Admin.
 */
const SUPER_ADMIN = "super admin";

function isCustomHtml(section) {
  return Boolean(section) && ((section.renderType || section.type) === "custom-html");
}

function customHtmlSections(raw) {
  const sections = parseJsonField(raw, []);
  return Array.isArray(sections) ? sections.filter(isCustomHtml) : [];
}

function htmlOf(section) {
  const content = parseJsonField(section?.content, {});
  return typeof content?.html === "string" ? content.html : "";
}

async function resolveRole(req) {
  if (typeof req.marketingUser?.role === "string") return req.marketingUser.role;
  const id = req.marketingUser?.sub;
  if (!id) return "";
  const user = await getMarketingUserModel().findByPk(id, { attributes: ["role"] });
  return user?.role || "";
}

async function isSuperAdmin(req) {
  return (await resolveRole(req)).trim().toLowerCase() === SUPER_ADMIN;
}

function forbidden(res) {
  return sendError(
    res,
    403,
    "Only Super Admins can add or change custom HTML sections.",
    "CUSTOM_HTML_FORBIDDEN",
  );
}

/** POST /admin/landing-pages and PATCH /admin/landing-pages/:id/draft */
exports.guardLandingPageCustomHtml = catchAsync(async (req, res, next) => {
  const incoming = customHtmlSections(req.body?.sections);
  const page = req.params?.id
    ? await getLandingPageModel().findByPk(req.params.id, { attributes: ["id", "draftSections", "tracking"] })
    : null;

  // A page's own header/body/footer scripts run on the website like custom HTML does.
  if (req.body?.tracking !== undefined && scriptsChanged(parseJsonField(page?.tracking, {}), req.body.tracking)) {
    if (!(await isSuperAdmin(req))) {
      return sendError(res, 403, "Only Super Admins can change custom tracking scripts.", "SCRIPTS_FORBIDDEN");
    }
  }

  if (incoming.length === 0) return next();
  const existing = customHtmlSections(page?.draftSections);
  const existingHtml = new Map(existing.map((s) => [s.id, htmlOf(s)]));
  const changed = incoming.some((s) => !existingHtml.has(s.id) || existingHtml.get(s.id) !== htmlOf(s));
  if (!changed) return next();

  if (await isSuperAdmin(req)) return next();
  return forbidden(res);
});

/** Custom templates and built-in template overrides. */
exports.guardTemplateCustomHtml = catchAsync(async (req, res, next) => {
  const body = req.body || {};
  const hasCustomHtml = [body.sections, body.initialSections, body.draftSections].some(
    (raw) => customHtmlSections(raw).length > 0,
  );
  if (!hasCustomHtml) return next();
  if (await isSuperAdmin(req)) return next();
  return forbidden(res);
});

exports.isSuperAdmin = isSuperAdmin;

/** Super Admin only (e.g. importing a page from a URL, which becomes custom HTML). */
exports.requireSuperAdmin = catchAsync(async (req, res, next) => {
  if (await isSuperAdmin(req)) return next();
  return sendError(res, 403, "Only Super Admins can import pages.", "SUPER_ADMIN_REQUIRED");
});
