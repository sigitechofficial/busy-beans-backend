const { Lead, LeadLog, sequelize } = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const { Op } = require("sequelize");
const sendCustomerEmail = require("../../helper/coffeeMachineQuotation");
const sendAdminEmail = require("../../helper/coffeeMachineQuotationAdmin");
const sendLeadQuotation = require("../../helper/leadQuotation");

/**
 * Controller for managing Leads
 */
class LeadController {
  /**
   * Get all leads with pagination, filtering, and search
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllLeads = catchAsync(async (req, res, next) => {
    const { page = 1, limit = 10, status, search, sort } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Search functionality
    if (search) {
      where[Op.or] = [
        { company: { [Op.like]: `%${search}%` } },
        { contactName: { [Op.like]: `%${search}%` } },
        { contactEmail: { [Op.like]: `%${search}%` } },
        // Cast id to string for search if needed, or exact match
        // { id: search }
      ];
      // If search is a number, add ID search
      if (!isNaN(search)) {
        where[Op.or].push({ id: search });
      }
    }

    // Sorting
    let order = [["createdAt", "DESC"]];
    if (sort) {
      const sortFields = sort.split(",");
      order = sortFields.map((field) => {
        if (field.startsWith("-")) {
          return [field.substring(1), "DESC"];
        }
        return [field, "ASC"];
      });
    }

    const { count, rows } = await Lead.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order,
      // include: [
      //   { model: User, as: "owner", attributes: ["id", "name", "email"] }, // Assuming association alias 'owner' or just model
      // ],
      distinct: true,
    });

    // Note: User association might not be defined as 'owner' in Lead model yet,
    // but requirement mentioned "ownerId". If association is missing, include might fail.
    // For now, I will comment out the include if I'm not sure about the alias,
    // or assume standard naming. The prompt said "User model (for associations)".
    // I will try to include it if possible, but safely.
    // Actually, looking at Lead.js provided by user, there is NO `ownerId` field defined in the snippet provided in Step 45.
    // However, the prompt in Step 49 says "Lead model with fields: ... ownerId ...".
    // I must assume the user might add it or it's implicitly there.
    // But the provided Lead.js did NOT have ownerId.
    // I will proceed without including User for now to avoid crash, or just include if it exists.

    res.status(200).json({
      success: true,
      data: {
        leads: rows,
        pagination: {
          total: count,
          totalPages: Math.ceil(count / limit),
          currentPage: parseInt(page),
          limit: parseInt(limit),
        },
      },
      message: "Leads retrieved successfully",
    });
  });

  /**
   * Get leads grouped by status for Kanban board
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getKanbanLeads = catchAsync(async (req, res, next) => {
    const leads = await Lead.findAll({
      order: [["createdAt", "DESC"]],
    });

    const kanbanData = {
      newEnquiry: [],
      contacted: [],
      quoted: [],
      demoScheduled: [],
      negotiation: [],
      nurture: [],
      won: [],
      lost: [],
    };

    const statusMap = {
      "New Enquiry": "newEnquiry",
      Contacted: "contacted",
      Quoted: "quoted",
      "Demo/Scheduled": "demoScheduled",
      Negotiation: "negotiation",
      Nurture: "nurture",
      WON: "won",
      LOST: "lost",
    };

    leads.forEach((lead) => {
      const key = statusMap[lead.status];
      if (key && kanbanData[key]) {
        kanbanData[key].push(lead);
      }
    });

    res.status(200).json({
      success: true,
      data: kanbanData,
      message: "Kanban leads retrieved successfully",
    });
  });

  /**
   * Get single lead by ID with logs
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getLeadById = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const lead = await Lead.findByPk(id, {
      include: [
        {
          model: LeadLog,
          // include: [{ model: User, attributes: ["id", "name"] }], // Assuming LeadLog belongsTo User
        },
      ],
    });

    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    res.status(200).json({
      success: true,
      data: lead,
      message: "Lead retrieved successfully",
    });
  });

  /**
   * Create a new lead
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createLead = catchAsync(async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
      const leadData = req.body;
      // Set creator if available in req.user
      if (req.user) {
        leadData.createdById = req.user.id;
      }

      const newLead = await Lead.create(leadData, { transaction });

      // Log creation
      await LeadLog.create(
        {
          LeadId: newLead.id,
          type: "status",
          message: "Lead created",
          // userId: req.user ? req.user.id : null,
        },
        { transaction }
      );

      await transaction.commit();

      // Send email notifications

      sendCustomerEmail({ data: req.body });
      sendAdminEmail({ data: req.body });

      res.status(201).json({
        success: true,
        data: newLead,
        message: "Lead created successfully",
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  });

  /**
   * Update a lead
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateLead = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const updates = req.body;
    const transaction = await sequelize.transaction();

    try {
      const lead = await Lead.findByPk(id, { transaction });

      if (!lead) {
        await transaction.rollback();
        return next(new AppError("Lead not found", 404));
      }

      const oldStatus = lead.status;

      // Update lead
      await lead.update({ ...updates }, { transaction });

      // Log status change if happened
      if (updates.status && updates.status !== oldStatus) {
        await LeadLog.create(
          {
            LeadId: lead.id,
            type: "status",
            message: `Status changed from ${oldStatus} to ${updates.status}`,
            // userId: req.user ? req.user.id : null,
          },
          { transaction }
        );
      }

      await transaction.commit();

      res.status(200).json({
        success: true,
        data: lead,
        message: "Lead updated successfully",
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  });

  /**
   * Schedule a follow-up
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  scheduleFollowUp = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { date, notes } = req.body;
    const transaction = await sequelize.transaction();

    try {
      const lead = await Lead.findByPk(id, { transaction });
      if (!lead) {
        await transaction.rollback();
        return next(new AppError("Lead not found", 404));
      }

      await lead.update(
        {
          followUpNextDate: date,
          followUpNeeded: true,
          followUpFeedback: notes, // Assuming this is where notes go, or maybe just log it
        },
        { transaction }
      );

      await LeadLog.create(
        {
          LeadId: lead.id,
          type: "note",
          message: `Follow-up scheduled for ${date}. Notes: ${notes}`,
          // userId: req.user ? req.user.id : null,
        },
        { transaction }
      );

      await transaction.commit();

      res.status(200).json({
        success: true,
        data: lead,
        message: "Follow-up scheduled successfully",
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  });

  /**
   * Send Quotation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  sendQuotation = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { amount, date } = req.body;
    const transaction = await sequelize.transaction();

    try {
      const lead = await Lead.findByPk(id, { transaction });
      if (!lead) {
        await transaction.rollback();
        return next(new AppError("Lead not found", 404));
      }

      await lead.update(
        {
          quotationSent: true,
          quotationAmount: amount,
          quotationDateSent: date || new Date(),
          status: "Quoted",
        },
        { transaction }
      );

      await LeadLog.create(
        {
          LeadId: lead.id,
          type: "email",
          message: `Quotation sent. Amount: ${amount}`,
          // userId: req.user ? req.user.id : null,
        },
        { transaction }
      );

      await transaction.commit();

      // Send quotation email
      sendLeadQuotation({ lead: lead.toJSON(), quotationAmount: amount });

      res.status(200).json({
        success: true,
        data: lead,
        message: "Quotation sent successfully",
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  });

  /**
   * Schedule Site Visit
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  scheduleSiteVisit = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { date, notes } = req.body;
    const transaction = await sequelize.transaction();

    try {
      const lead = await Lead.findByPk(id, { transaction });
      if (!lead) {
        await transaction.rollback();
        return next(new AppError("Lead not found", 404));
      }

      await lead.update(
        {
          siteVisitScheduled: true,
          siteVisitDate: date,
          siteVisitNotes: notes,
        },
        { transaction }
      );

      await LeadLog.create(
        {
          LeadId: lead.id,
          type: "status",
          message: `Site visit scheduled for ${date}`,
          // userId: req.user ? req.user.id : null,
        },
        { transaction }
      );

      await transaction.commit();

      res.status(200).json({
        success: true,
        data: lead,
        message: "Site visit scheduled successfully",
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  });

  /**
   * Mark lead as WON
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  markAsWon = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const transaction = await sequelize.transaction();

    try {
      const lead = await Lead.findByPk(id, { transaction });
      if (!lead) {
        await transaction.rollback();
        return next(new AppError("Lead not found", 404));
      }

      await lead.update(
        {
          status: "WON",
          customerStatus: "Interested", // Or whatever implies converted
        },
        { transaction }
      );

      await LeadLog.create(
        {
          LeadId: lead.id,
          type: "status",
          message: "Lead marked as WON",
          // userId: req.user ? req.user.id : null,
        },
        { transaction }
      );

      await transaction.commit();

      res.status(200).json({
        success: true,
        data: lead,
        message: "Lead marked as WON",
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  });

  /**
   * Mark lead as LOST
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  markAsLost = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { reason, feedback } = req.body;
    const transaction = await sequelize.transaction();

    try {
      const lead = await Lead.findByPk(id, { transaction });
      if (!lead) {
        await transaction.rollback();
        return next(new AppError("Lead not found", 404));
      }

      await lead.update(
        {
          status: "LOST",
          lostReason: reason,
          customerFeedback: feedback,
          customerStatus: "Not Interested",
        },
        { transaction }
      );

      await LeadLog.create(
        {
          LeadId: lead.id,
          type: "status",
          message: `Lead marked as LOST. Reason: ${reason}`,
          // userId: req.user ? req.user.id : null,
        },
        { transaction }
      );

      await transaction.commit();

      res.status(200).json({
        success: true,
        data: lead,
        message: "Lead marked as LOST",
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  });

  /**
   * Delete a lead
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteLead = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    // Hard delete or soft delete? Lead model has timestamps but not paranoid: true in the snippet I saw.
    // Assuming hard delete for now unless paranoid is enabled.

    const lead = await Lead.findByPk(id);
    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    await lead.destroy();

    res.status(200).json({
      success: true,
      data: null,
      message: "Lead deleted successfully",
    });
  });

  /**
   * Get Lead Statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getLeadStats = catchAsync(async (req, res, next) => {
    const totalLeads = await Lead.count();

    const leadsByStatus = await Lead.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("status")), "count"],
      ],
      group: ["status"],
    });

    const wonCount = await Lead.count({ where: { status: "WON" } });
    const conversionRate =
      totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalLeads,
        leadsByStatus,
        conversionRate,
      },
      message: "Lead statistics retrieved successfully",
    });
  });
}

module.exports = new LeadController();
