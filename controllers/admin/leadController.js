    const {
    Lead,
    LeadLog,
    GetInTouch,
    salesRep,
    employee,
    sequelize,
    } = require("../../models");
    const catchAsync = require("../../utils/catchAsync");
    const AppError = require("../../utils/appError");
    const { isHqOperator } = require("../../utils/hqOperator");
    const { Op } = require("sequelize");
    const sendCustomerEmail = require("../../helper/coffeeMachineQuotation");
    const sendAdminEmail = require("../../helper/coffeeMachineQuotationAdmin");
    const sendLeadQuotation = require("../../helper/leadQuotation");
    const {
    sendIfAllowed,
    leadPerson,
    hqPerson,
    } = require("../../utils/emailSendGate");
const { customerEmailRecipients, leadAlertRecipients } = require("../../utils/emailRecipients");
    const {
    createLeadLog,
    formatLogDetails,
    extractEntityInfo,
    } = require("../../utils/leadLogger");

    const { escapeStrings, escapeHtml } = require("../../utils/escapeHtml");
    const { ENQUIRY_TYPES, cleanEventId, syncToMarketing, attachMarketingSource } = require("../../utils/leadPipeline");
    const { transporter } = require("../../helper/transpoter");

    /**
     * Leads a user may see or change: HQ (admin / sub-admin) all, a local partner the leads assigned
     * to them, an employee the leads assigned to them. Anyone else none.
     */
    const leadScope = (user) => {
    const entity = user?.entity;
    if (isHqOperator(entity)) return {};
    if (entity === "localPartner") return { salesRepId: user.id };
    if (entity === "adminEmployee" || entity === "partnerEmployee") return { employeeId: user.id };
    return { id: null };
    };
    /** Set only through /assign (and by HQ); never through a generic update or the public form. */
    const ASSIGNMENT_FIELDS = ["salesRepId", "employeeId", "assignedBy", "assignedAt"];
    /** What the public website form (POST /api/v1/users/create-lead) may set, with length limits. */
    const PUBLIC_LEAD_FIELDS = {
    machineId: 0, machineName: 255, userId: 50, contactName: 255, company: 255, role: 255, contactEmail: 255,
    contactPhone: 20, addressLineOne: 255, addressLineTwo: 255, city: 255, state: 255, country: 255, zipCode: 32,
    leadSource: 0, preferredContact: 0, businessType: 255, businessLocation: 255, estimatedValue: 50,
    snapshotType: 255, snapshotUseCase: 255, snapshotVolume: 255, snapshotTimeline: 255, notes: 5000,
    };
    const LEAD_SOURCES = ["Instagram", "Website", "Referral", "Cold Call", "WhatsApp", "Other"];
    const PREFERRED_CONTACT = ["Email", "Phone", "WhatsApp"];
    const HONEYPOT_FIELD = "website";

    /** Email the person a lead was just assigned to (their account email). Never blocks the assignment. */
    async function notifyAssignee(person, lead, assignedByName) {
    try {
        if (!person?.email) return;
        const name = person.srName || person.name || "there";
        const url = `${String(process.env.ADMIN_PANEL_URL || "").replace(/\/+$/, "")}/leads/${lead.id}`;
        const rows = [
        ["Company", lead.company],
        ["Contact", lead.contactName],
        ["Email", lead.contactEmail],
        ["Phone", lead.contactPhone],
        ["Stage", lead.status],
        ].filter(([, v]) => v);
        await new Promise((resolve) => {
        transporter.sendMail(
            {
            from: process.env.EMAIL_USERNAME,
            to: person.email,
            subject: `New lead assigned: ${lead.company || lead.contactName}`,
            html: `<p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(assignedByName || "Busy Beans")} assigned you a lead.</p>
<table cellpadding="4">${rows.map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${escapeHtml(v)}</td></tr>`).join("")}</table>
${process.env.ADMIN_PANEL_URL ? `<p><a href="${escapeHtml(url)}">Open the lead</a></p>` : ""}`,
            },
            (error) => {
            if (error) console.error("lead assignment email failed:", error.message);
            resolve();
            },
        );
        });
    } catch (error) {
        console.error("lead assignment email failed:", error.message);
    }
    }

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

        const where = { ...leadScope(req.user) };

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
        if (isHqOperator(req.user?.entity)) {
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

        const found = await Lead.findAll({
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
        // Source / campaign from the linked Campaign Builder lead.
        const leads = await attachMarketingSource(found);

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

        const lead = await Lead.findOne({
        where: { id, ...leadScope(req.user) },
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

        const [withSource] = await attachMarketingSource([lead]);
        res.status(200).json({
        success: true,
        data: withSource,
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
        const leadData = { ...(req.body || {}) };
        delete leadData.id;
        if (req.user && !ENQUIRY_TYPES.includes(leadData.enquiryType)) leadData.enquiryType = "manual";
        // Set creator if available in req.user
        if (req.user) {
            leadData.createdById = req.user.id;
            if (req.user.entity === "localPartner") leadData.salesRepId = req.user.id;
            if (req.user.entity === "partnerEmployee" || req.user.entity === "adminEmployee") {
            for (const k of ASSIGNMENT_FIELDS) delete leadData[k];
            }
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

        await sendIfAllowed({
            ...leadPerson(),
            emailType: "coffee_machine_customer",
            recipients: (await customerEmailRecipients(req.body?.contactEmail || req.body?.email)).join(", "),
            send: async () => sendCustomerEmail({ data: escapeStrings(leadData) }),
        });
        await sendIfAllowed({
            ...hqPerson(),
            emailType: "coffee_machine_admin",
            recipients: (await leadAlertRecipients()).join(", "),
            send: async () => sendAdminEmail({ data: escapeStrings(leadData) }),
        });

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
     * Public website form (POST /api/v1/users/create-lead): only the contact / requirement fields
     * are accepted (never status, assignment, quotation or ids); a filled honeypot field looks
     * successful but stores nothing. Then the normal create (log + emails).
     */
    createPublicLead = catchAsync(async (req, res, next) => {
        const body = req.body || {};
        if (typeof body[HONEYPOT_FIELD] === "string" && body[HONEYPOT_FIELD].trim()) {
        return res.status(201).json({ success: true, data: null, message: "Lead created successfully" });
        }
        const data = {};
        for (const [key, max] of Object.entries(PUBLIC_LEAD_FIELDS)) {
        const value = body[key];
        if (value === undefined || value === null || value === "") continue;
        data[key] = typeof value === "string" && max ? value.trim().slice(0, max) : value;
        }
        if (!LEAD_SOURCES.includes(data.leadSource)) data.leadSource = "Website";
        if (data.preferredContact && !PREFERRED_CONTACT.includes(data.preferredContact)) delete data.preferredContact;
        if (data.machineId !== undefined && !Number.isInteger(Number(data.machineId))) delete data.machineId;
        if (!data.contactName || !data.company) return next(new AppError("Name and company are required.", 400));
        data.enquiryType = "machine";
        const eventId = cleanEventId(body.marketingEventId);
        if (eventId) data.marketingEventId = eventId;
        req.body = data;
        req.user = undefined;
        return this.createLead(req, res, next);
    });

    /**
     * Update a lead
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    updateLead = catchAsync(async (req, res, next) => {
        const { id } = req.params;
        const updates = { ...(req.body || {}) };
        delete updates.id;
        // Assignment changes go through /assign; only HQ may set them in a generic update.
        if (!isHqOperator(req.user?.entity)) for (const k of ASSIGNMENT_FIELDS) delete updates[k];
        const transaction = await sequelize.transaction();

        try {
        const lead = await Lead.findOne({ where: { id, ...leadScope(req.user) }, transaction });

        if (!lead) {
            await transaction.rollback();
            return next(new AppError("Lead not found", 404));
        }

        const oldStatus = lead.status;
        if (updates.wonAmount !== undefined && updates.wonAmount !== null && updates.wonAmount !== "") {
            const n = Number(updates.wonAmount);
            if (!Number.isFinite(n) || n < 0) {
            await transaction.rollback();
            return next(new AppError("Won amount must be a number of 0 or more.", 400));
            }
            updates.wonAmount = n;
        }
        if (updates.status === "WON" && oldStatus !== "WON") updates.wonAt = new Date();

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
        if (updates.status !== undefined || updates.wonAmount !== undefined) await syncToMarketing(lead);

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
        const lead = await Lead.findOne({ where: { id, ...leadScope(req.user) }, transaction });
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
        const lead = await Lead.findOne({ where: { id, ...leadScope(req.user) }, transaction });
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
        await syncToMarketing(lead);

        // Send quotation email
        await sendIfAllowed({
            ...leadPerson(),
            emailType: "lead_quotation",
            recipients: lead.contactEmail || lead.email,
            send: async () =>
            sendLeadQuotation({ lead: lead.toJSON(), quotationAmount: amount }),
        });

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
        const lead = await Lead.findOne({ where: { id, ...leadScope(req.user) }, transaction });
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
        const lead = await Lead.findOne({ where: { id, ...leadScope(req.user) }, transaction });
        if (!lead) {
            await transaction.rollback();
            return next(new AppError("Lead not found", 404));
        }

        const rawAmount = req.body?.amount;
        let wonAmount = lead.wonAmount;
        if (rawAmount !== undefined && rawAmount !== null && rawAmount !== "") {
            wonAmount = Number(rawAmount);
            if (!Number.isFinite(wonAmount) || wonAmount < 0) {
            await transaction.rollback();
            return next(new AppError("Won amount must be a number of 0 or more.", 400));
            }
        }
        await lead.update(
            {
            status: "WON",
            customerStatus: "Interested", // Or whatever implies converted
            wonAmount,
            wonAt: lead.wonAt || new Date(),
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
        await syncToMarketing(lead);

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
        const { feedback } = req.body || {};
        const LOST_REASONS = ["Price Too High", "Timeline Mismatch", "Chose Competitor", "Not Interested", "Budget Constraints", "Other"];
        const reason = LOST_REASONS.includes(req.body?.reason) ? req.body.reason : "Other";
        const transaction = await sequelize.transaction();

        try {
        const lead = await Lead.findOne({ where: { id, ...leadScope(req.user) }, transaction });
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
        await syncToMarketing(lead);

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

        const lead = await Lead.findOne({ where: { id, ...leadScope(req.user) } });
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
        const scope = leadScope(req.user);
        const totalLeads = await Lead.count({ where: scope });

        const leadsByStatus = await Lead.findAll({
        where: scope,
        attributes: [
            "status",
            [sequelize.fn("COUNT", sequelize.col("status")), "count"],
        ],
        group: ["status"],
        });

        const wonCount = await Lead.count({ where: { ...scope, status: "WON" } });
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

        const lead = await Lead.findOne({ where: { id, ...leadScope(req.user) }, transaction });
        if (!lead) {
            await transaction.rollback();
            return next(new AppError("Lead not found", 404));
        }

        // Who may assign what: HQ anything; a local partner only themselves / their own employees;
        // employees cannot reassign.
        const entity = req.user?.entity;
        if (entity === "adminEmployee" || entity === "partnerEmployee") {
            await transaction.rollback();
            return next(new AppError("You cannot reassign leads.", 403));
        }
        if (entity === "localPartner") {
            if (salesRepId !== undefined && salesRepId !== null && Number(salesRepId) !== Number(req.user.id)) {
            await transaction.rollback();
            return next(new AppError("You can only assign leads to yourself or your employees.", 403));
            }
            if (employeeId) {
            const own = await employee.findOne({ where: { id: employeeId, salesRepId: req.user.id }, transaction });
            if (!own) {
                await transaction.rollback();
                return next(new AppError("You can only assign leads to your own employees.", 403));
            }
            }
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
            if (isHqOperator(req.user?.entity)) {
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
        await notifyAssignee(assignedSalesRep || assignedEmployee, lead, extractEntityInfo(req.user).entityName);

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
    /** POST /api/v1/leads/:id/comments { message } — a note on the lead's activity timeline. */
    addComment = catchAsync(async (req, res, next) => {
        const { id } = req.params;
        const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 2000) : "";
        if (!message) return next(new AppError("Note cannot be empty.", 400));
        const lead = await Lead.findOne({ where: { id, ...leadScope(req.user) } });
        if (!lead) return next(new AppError("Lead not found", 404));
        const entityInfo = extractEntityInfo(req.user);
        const log = await createLeadLog({
        leadId: lead.id,
        action: "comment",
        details: `${entityInfo.entityName || "Someone"} added a note`,
        message,
        user: req.user,
        type: "comment",
        });
        res.status(201).json({ success: true, data: log, message: "Note added" });
    });

    getLeadLogs = catchAsync(async (req, res, next) => {
        const { id } = req.params;

        const lead = await Lead.findOne({ where: { id, ...leadScope(req.user) } });
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

    /**
     * Get all get-in-touch submissions for admin panel
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    getAllGetInTouch = catchAsync(async (req, res, next) => {
        const { page = 1, limit = 20, search } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        const where = {};
        if (search) {
        where[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { phone: { [Op.like]: `%${search}%` } },
            { company: { [Op.like]: `%${search}%` } },
        ];
        }

        const { count, rows } = await GetInTouch.findAndCountAll({
        where,
        limit: parseInt(limit, 10),
        offset,
        order: [["createdAt", "DESC"]],
        });

        res.status(200).json({
        success: true,
        data: {
            submissions: rows,
            pagination: {
            total: count,
            totalPages: Math.ceil(count / parseInt(limit, 10)),
            currentPage: parseInt(page, 10),
            limit: parseInt(limit, 10),
            },
        },
        message: "Get in touch submissions retrieved successfully",
        });
    });

    /**
     * Delete a get-in-touch submission by id (admin)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    deleteGetInTouch = catchAsync(async (req, res, next) => {
        const { id } = req.params;

        const submission = await GetInTouch.findByPk(id);
        if (!submission) {
        return next(new AppError("Get in touch submission not found", 404));
        }

        await submission.destroy();

        res.status(200).json({
        success: true,
        message: "Get in touch submission deleted successfully",
        });
    });
    }

    module.exports = new LeadController();
