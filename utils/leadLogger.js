// utils/leadLogger.js
const { LeadLog } = require("../models");

/**
 * Entity type mapping for extracting the correct entity information
 * Maps user entity types to their corresponding model name fields
 */
const ENTITY_CONFIG = {
  admin: {
    modelIdField: "id", // The ID is stored in req.user.id
    modelNameField: "name",
    entityType: "admin",
  },
  supplier: {
    modelIdField: "id",
    modelNameField: "supplierName",
    entityType: "supplier",
  },
  localPartner: {
    modelIdField: "id",
    modelNameField: "srName",
    entityType: "localPartner",
  },
  adminEmployee: {
    modelIdField: "id",
    modelNameField: "name",
    entityType: "adminEmployee",
  },
  partnerEmployee: {
    modelIdField: "id",
    modelNameField: "name",
    entityType: "partnerEmployee",
  },
};

/**
 * Extract entity information from req.user
 * @param {Object} user - req.user object
 * @returns {Object} - { entityType, entityId, entityName }
 */
const extractEntityInfo = (user) => {
  if (!user) {
    return {
      entityType: null,
      entityId: null,
      entityName: "System",
    };
  }

  const entity = user.entity || "admin";
  const config = ENTITY_CONFIG[entity] || ENTITY_CONFIG.admin;

  return {
    entityType: config.entityType,
    entityId: user.id,
    entityName: user[config.modelNameField] || user.name || "Unknown",
  };
};

/**
 * Create a lead log entry with full entity tracking
 * @param {Object} params
 * @param {number} params.leadId - The lead ID
 * @param {string} params.action - Action type (created, updated, assigned, etc.)
 * @param {string} params.details - Full description for timeline
 * @param {Object} params.user - req.user object
 * @param {string} params.type - Log type (status, update, comment, etc.)
 * @param {string} params.message - Legacy message field
 * @param {string} params.stageNote - Optional stage note
 * @param {Object} params.transaction - Optional transaction object
 * @returns {Promise<LeadLog>}
 */
const createLeadLog = async ({
  leadId,
  action,
  details,
  user = null,
  type = "update",
  message = null,
  stageNote = null,
  transaction = null,
}) => {
  const entityInfo = extractEntityInfo(user);

  const logData = {
    LeadId: leadId,
    entityType: entityInfo.entityType,
    entityId: entityInfo.entityId,
    entityName: entityInfo.entityName,
    action,
    details: details || message,
    type,
    message: message || details,
    stageNote,
  };

  const options = transaction ? { transaction } : {};
  return await LeadLog.create(logData, options);
};

/**
 * Create a formatted details message for common actions
 * @param {string} action - Action type
 * @param {Object} data - Additional data for the message
 * @param {string} entityName - Name of the entity performing the action
 * @returns {string}
 */
const formatLogDetails = (action, data = {}, entityName = "User") => {
  switch (action) {
    case "created":
      return `Lead created by ${entityName}`;

    case "status_changed":
      return `${entityName} changed status from "${data.oldStatus}" to "${data.newStatus}"${
        data.note ? `. Note: ${data.note}` : ""
      }`;

    case "assigned":
      return `${entityName} assigned lead to ${data.assigneeName} (${data.assigneeType})`;

    case "quotation_sent":
      return `${entityName} sent quotation. Amount: ${data.amount}`;

    case "follow_up_scheduled":
      return `${entityName} scheduled follow-up for ${data.date}${
        data.notes ? `. Notes: ${data.notes}` : ""
      }`;

    case "site_visit_scheduled":
      return `${entityName} scheduled site visit for ${data.date}`;

    case "marked_won":
      return `${entityName} marked lead as WON`;

    case "marked_lost":
      return `${entityName} marked lead as LOST. Reason: ${data.reason}`;

    case "updated":
      return `${entityName} updated lead information`;

    case "comment":
      return `${entityName} added a comment: ${data.comment}`;

    default:
      return `${entityName} performed action: ${action}`;
  }
};

module.exports = {
  createLeadLog,
  extractEntityInfo,
  formatLogDetails,
  ENTITY_CONFIG,
};
