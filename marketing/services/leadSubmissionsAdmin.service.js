const { Op } = require("sequelize");
const { getLeadSubmissionModel } = require("../models/leadSubmission");
const {
  formatLeadRow,
  parseLeadId,
} = require("./leadSubmissions.service");

const CONVERSION_STATUSES = ["new", "contacted", "qualified", "won", "lost"];

async function listLeads(options = {}) {
  const includeTest = Boolean(options.includeTest);
  const LeadSubmission = getLeadSubmissionModel();
  const where = includeTest ? {} : { testMode: false };

  const rows = await LeadSubmission.findAll({
    where,
    order: [["submitted_at", "DESC"]],
    limit: Number(options.limit) > 0 ? Number(options.limit) : 500,
  });

  return rows.map(formatLeadRow);
}

async function getLeadById(id) {
  const numericId = parseLeadId(id);
  if (!numericId) return null;
  const LeadSubmission = getLeadSubmissionModel();
  const row = await LeadSubmission.findByPk(numericId);
  if (!row) return null;
  return formatLeadRow(row);
}

async function updateLead(id, patch = {}) {
  const numericId = parseLeadId(id);
  if (!numericId) return null;
  const LeadSubmission = getLeadSubmissionModel();
  const row = await LeadSubmission.findByPk(numericId);
  if (!row) return null;

  if (patch.conversionStatus !== undefined) {
    if (!CONVERSION_STATUSES.includes(patch.conversionStatus)) {
      const error = new Error("Invalid conversionStatus.");
      error.code = "VALIDATION_ERROR";
      throw error;
    }
    if (patch.conversionStatus === "won" && row.conversionStatus !== "won") row.convertedAt = new Date();
    if (patch.conversionStatus !== "won") row.convertedAt = null;
    row.conversionStatus = patch.conversionStatus;
  }

  if (patch.revenue !== undefined) {
    row.revenue = patch.revenue === null ? null : Number(patch.revenue);
  }

  if (patch.profit !== undefined) {
    row.profit = patch.profit === null ? null : Number(patch.profit);
  }

  if (patch.notes !== undefined) {
    row.notes = patch.notes === null ? "" : String(patch.notes);
  }

  await row.save();
  if (!row.testMode && row.eventId && (patch.conversionStatus !== undefined || patch.revenue !== undefined)) {
    await syncToSalesPipeline(row);
  }
  return formatLeadRow(row);
}

/** Status / revenue set here → the linked admin panel Kanban lead. Never fails the update. */
async function syncToSalesPipeline(row) {
  try {
    // Lazy: commerce models are not loaded in marketing-only scripts.
    // eslint-disable-next-line global-require
    const { syncFromMarketing } = require("../../utils/leadPipeline");
    await syncFromMarketing({ eventId: row.eventId, status: row.conversionStatus, revenue: row.revenue });
  } catch (error) {
    console.error("lead status → sales pipeline failed:", error.message);
  }
}

async function deleteLead(id) {
  const numericId = parseLeadId(id);
  if (!numericId) return { deleted: false, reason: "NOT_FOUND" };
  const LeadSubmission = getLeadSubmissionModel();
  const row = await LeadSubmission.findByPk(numericId);
  if (!row) return { deleted: false, reason: "NOT_FOUND" };
  await row.destroy();
  return { deleted: true };
}

async function countNonTestLeads(range) {
  const LeadSubmission = getLeadSubmissionModel();
  const where = { testMode: false };
  if (range.start || range.end) {
    where.submittedAt = {};
    if (range.start) where.submittedAt[Op.gte] = range.start;
    if (range.end) where.submittedAt[Op.lte] = range.end;
  }
  return LeadSubmission.count({ where });
}

/** Distinct visitors with a non-test lead in the range (a lead without a visitor id counts once). */
async function countLeadVisitors(range) {
  const LeadSubmission = getLeadSubmissionModel();
  const where = ["test_mode = 0"];
  const replacements = {};
  if (range.start) {
    where.push("submitted_at >= :start");
    replacements.start = range.start;
  }
  if (range.end) {
    where.push("submitted_at <= :end");
    replacements.end = range.end;
  }
  const [row] = await LeadSubmission.sequelize.query(
    `SELECT COUNT(DISTINCT COALESCE(visitor_id, CONCAT('lead:', id))) AS n FROM lead_submissions WHERE ${where.join(" AND ")}`,
    { replacements, type: LeadSubmission.sequelize.QueryTypes.SELECT },
  );
  return Number(row?.n || 0);
}

module.exports = {
  listLeads,
  getLeadById,
  updateLead,
  deleteLead,
  countNonTestLeads,
  countLeadVisitors,
};
