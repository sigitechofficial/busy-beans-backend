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
  return formatLeadRow(row);
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

module.exports = {
  listLeads,
  getLeadById,
  updateLead,
  deleteLead,
  countNonTestLeads,
};
