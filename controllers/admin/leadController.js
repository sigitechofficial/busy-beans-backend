const {
  Lead,
  LeadLog,
  salesRep,
  employee,
  sequelize,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const { Op } = require("sequelize");
const sendCustomerEmail = require("../../helper/coffeeMachineQuotation");
const sendAdminEmail = require("../../helper/coffeeMachineQuotationAdmin");
const sendLeadQuotation = require("../../helper/leadQuotation");
const {
  createLeadLog,
  formatLogDetails,
  extractEntityInfo,
} = require("../../utils/leadLogger");

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
      include: [
        {
          model: salesRep,
          as: "assignedSalesRep",
          attributes: ["id", "srName", "email"],
        },
        {
          model: employee,
          as: "assignedEmployee",
          attributes: ["id", "name", "email", "employeeOf"],
        },
      ],
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
    // Role-based filtering
    const where = {};

    // Admin sees all leads
    if (req.user?.entity === "admin") {
      // No filter needed - admin sees all
    } else if (req.user?.entity === "localPartner") {
      // Local partner sees leads assigned to them
      where.salesRepId = req.user.id;
    } else if (
      req.user?.entity === "adminEmployee" ||
      req.user?.entity === "partnerEmployee"
    ) {
      // Employees see leads assigned to them
      where.employeeId = req.user.id;
    }

    const leads = await Lead.findAll({
      where,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: salesRep,
          as: "assignedSalesRep",
          attributes: ["id", "srName", "email"],
        },
        {
          model: employee,
          as: "assignedEmployee",
          attributes: ["id", "name", "email"],
        },
      ],
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
   * Get single lead by ID with logs and assignment details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getLeadById = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const lead = await Lead.findByPk(id, {
      include: [
        {
          model: LeadLog,
          order: [["createdAt", "DESC"]],
        },
        {
          model: salesRep,
          as: "assignedSalesRep",
          attributes: ["id", "srName", "email", "phoneNumber", "countryCode"],
        },
        {
          model: employee,
          as: "assignedEmployee",
          attributes: [
            "id",
            "name",
            "email",
            "phoneNumber",
            "countryCode",
            "employeeOf",
          ],
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

      // Log creation with entity tracking
      const entityInfo = extractEntityInfo(req.user);
      await createLeadLog({
        leadId: newLead.id,
        action: "created",
        details: formatLogDetails("created", {}, entityInfo.entityName),
        user: req.user,
        type: "status",
        transaction,
      });

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
        const entityInfo = extractEntityInfo(req.user);
        await createLeadLog({
          leadId: lead.id,
          action: "status_changed",
          details: formatLogDetails(
            "status_changed",
            { oldStatus, newStatus: updates.status, note: updates.stageNote },
            entityInfo.entityName
          ),
          user: req.user,
          type: "status",
          stageNote: updates.stageNote || null,
          transaction,
        });
      } else {
        // Log general update
        const entityInfo = extractEntityInfo(req.user);
        await createLeadLog({
          leadId: lead.id,
          action: "updated",
          details: formatLogDetails("updated", {}, entityInfo.entityName),
          user: req.user,
          type: "update",
          transaction,
        });
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

      const entityInfo = extractEntityInfo(req.user);
      await createLeadLog({
        leadId: lead.id,
        action: "follow_up_scheduled",
        details: formatLogDetails(
          "follow_up_scheduled",
          { date, notes },
          entityInfo.entityName
        ),
        user: req.user,
        type: "note",
        transaction,
      });

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

      const entityInfo = extractEntityInfo(req.user);
      await createLeadLog({
        leadId: lead.id,
        action: "quotation_sent",
        details: formatLogDetails(
          "quotation_sent",
          { amount },
          entityInfo.entityName
        ),
        user: req.user,
        type: "email",
        transaction,
      });

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

      const entityInfo = extractEntityInfo(req.user);
      await createLeadLog({
        leadId: lead.id,
        action: "site_visit_scheduled",
        details: formatLogDetails(
          "site_visit_scheduled",
          { date },
          entityInfo.entityName
        ),
        user: req.user,
        type: "status",
        transaction,
      });

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

      const entityInfo = extractEntityInfo(req.user);
      await createLeadLog({
        leadId: lead.id,
        action: "marked_won",
        details: formatLogDetails("marked_won", {}, entityInfo.entityName),
        user: req.user,
        type: "status",
        transaction,
      });

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

      const entityInfo = extractEntityInfo(req.user);
      await createLeadLog({
        leadId: lead.id,
        action: "marked_lost",
        details: formatLogDetails(
          "marked_lost",
          { reason },
          entityInfo.entityName
        ),
        user: req.user,
        type: "status",
        transaction,
      });

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

  /**
   * Assign Lead to SalesRep or Employee
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  assignLead = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { salesRepId, employeeId } = req.body;
    const transaction = await sequelize.transaction();

    try {
      // Validate that at least one assignment is provided
      if (!salesRepId && !employeeId) {
        await transaction.rollback();
        return next(
          new AppError("Either salesRepId or employeeId must be provided", 400)
        );
      }

      const lead = await Lead.findByPk(id, { transaction });
      if (!lead) {
        await transaction.rollback();
        return next(new AppError("Lead not found", 404));
      }

      // Validate salesRep exists if provided
      let assignedSalesRep;
      if (salesRepId) {
        assignedSalesRep = await salesRep.findByPk(salesRepId, { transaction });
        if (!assignedSalesRep || assignedSalesRep.deleted) {
          await transaction.rollback();
          return next(new AppError("Sales Representative not found", 404));
        }
      }

      // Validate employee exists if provided
      let assignedEmployee;
      if (employeeId) {
        assignedEmployee = await employee.findByPk(employeeId, { transaction });
        if (!assignedEmployee || assignedEmployee.deleted) {
          await transaction.rollback();
          return next(new AppError("Employee not found", 404));
        }
      }

      // Build update object - preserve existing assignments if not explicitly provided
      const updateData = {
        assignedBy: req.user?.id || null,
        assignedAt: new Date(),
      };

      // Only update employeeId if explicitly provided in request
      if (employeeId !== undefined) {
        updateData.employeeId = employeeId;
      }

      // Handle salesRepId based on entity and what's provided
      if (salesRepId !== undefined) {
        // If salesRepId is explicitly provided, use it
        updateData.salesRepId = salesRepId;
      } else if (employeeId !== undefined) {
        // If employeeId is provided but salesRepId is not:
        if (req.user?.entity === "admin") {
          // Admin assigning employee: clear salesRepId
          updateData.salesRepId = null;
        } else if (req.user?.entity === "localPartner" && lead.salesRepId) {
          // LocalPartner assigning employee: preserve existing salesRepId
          // Don't include salesRepId in updateData, so it remains unchanged
        }
        // For other entities or if lead has no salesRepId, don't modify salesRepId
      }

      // Update lead assignment
      await lead.update(updateData, { transaction });

      // Reload lead to get current state
      await lead.reload({ transaction });

      // Build log message based on what was assigned
      let logDetails = "";
      const entityInfo = extractEntityInfo(req.user);

      if (salesRepId && employeeId) {
        // Both assigned
        const salesRepName = assignedSalesRep
          ? assignedSalesRep.srName
          : "Unknown";
        const employeeName = assignedEmployee
          ? assignedEmployee.name
          : "Unknown";
        logDetails = `${entityInfo.entityName} assigned lead to ${salesRepName} (Sales Rep) and ${employeeName} (Employee)`;
      } else if (salesRepId) {
        // Only sales rep assigned
        const salesRepName = assignedSalesRep
          ? assignedSalesRep.srName
          : "Unknown";
        logDetails = `${entityInfo.entityName} assigned lead to ${salesRepName} (Sales Representative)`;
      } else if (employeeId) {
        // Only employee assigned (preserve existing salesRep if exists)
        const employeeName = assignedEmployee
          ? assignedEmployee.name
          : "Unknown";
        if (lead.salesRepId) {
          logDetails = `${entityInfo.entityName} assigned ${employeeName} (Employee) to assist with this lead`;
        } else {
          logDetails = `${entityInfo.entityName} assigned lead to ${employeeName} (Employee)`;
        }
      }

      // Log assignment
      await createLeadLog({
        leadId: lead.id,
        action: "assigned",
        details: logDetails,
        user: req.user,
        type: "assignment",
        transaction,
      });

      await transaction.commit();

      // Reload lead with associations
      const updatedLead = await Lead.findByPk(id, {
        include: [
          {
            model: salesRep,
            as: "assignedSalesRep",
            attributes: ["id", "srName", "email"],
          },
          {
            model: employee,
            as: "assignedEmployee",
            attributes: ["id", "name", "email"],
          },
        ],
      });

      res.status(200).json({
        success: true,
        data: updatedLead,
        message: "Lead assigned successfully",
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  });

  /**
   * Get Lead Logs/Timeline
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getLeadLogs = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const lead = await Lead.findByPk(id);
    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    const logs = await LeadLog.findAll({
      where: { LeadId: id },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        leadId: id,
        logs,
      },
      message: "Lead logs retrieved successfully",
    });
  });
}

module.exports = new LeadController();
