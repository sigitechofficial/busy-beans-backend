// models/Lead.js
const { DataTypes } = require("sequelize");
module.exports = (sequelize) => {
  const Lead = sequelize.define(
    "Lead",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      // Machine Info
      machineId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      machineName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      // User Reference
      userId: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      // Basic Info
      company: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      role: {
        type: DataTypes.STRING(100),
      },
      // Contact Info
      contactName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      contactPhone: {
        type: DataTypes.STRING(20),
      },
      contactEmail: {
        type: DataTypes.STRING(255),
      },
      // Address Info
      addressLineOne: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      addressLineTwo: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      zipCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      // Lead Tracking
      leadSource: {
        type: DataTypes.ENUM(
          "Instagram",
          "Website",
          "Referral",
          "Cold Call",
          "WhatsApp",
          "Other"
        ),
        defaultValue: "Website",
      },
      leadDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      preferredContact: {
        type: DataTypes.ENUM("Email", "Phone", "WhatsApp"),
        defaultValue: "Email",
      },
      // Pipeline Status
      status: {
        type: DataTypes.ENUM(
          "New Enquiry",
          "Contacted",
          "Quoted",
          "Demo/Scheduled",
          "Negotiation",
          "Nurture",
          "WON",
          "LOST"
        ),
        defaultValue: "New Enquiry",
      },
      tag: {
        type: DataTypes.ENUM("Hot Lead", "Warm Lead", "Cold Lead"),
        defaultValue: "Warm Lead",
      },
      // Business Info
      businessType: {
        type: DataTypes.STRING(100),
      },
      businessLocation: {
        type: DataTypes.STRING(255),
      },
      // Commercial
      estimatedValue: {
        type: DataTypes.STRING(50),
      },
      // Follow-up
      followUpNextDate: {
        type: DataTypes.DATE,
      },
      followUpNeeded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      followUpFeedback: {
        type: DataTypes.TEXT,
      },
      // Customer Status
      customerStatus: {
        type: DataTypes.ENUM("Interested", "In Future", "Not Interested"),
        defaultValue: "Interested",
      },
      // Quotation
      quotationSent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      quotationAmount: {
        type: DataTypes.STRING(50),
      },
      quotationDateSent: {
        type: DataTypes.DATE,
      },
      // Site Visit
      siteVisitScheduled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      siteVisitDate: {
        type: DataTypes.DATE,
      },
      siteVisitCompleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      siteVisitNotes: {
        type: DataTypes.TEXT,
      },
      // Requirement Snapshot
      snapshotType: {
        type: DataTypes.STRING(100),
      },
      snapshotUseCase: {
        type: DataTypes.STRING(100),
      },
      snapshotVolume: {
        type: DataTypes.STRING(100),
      },
      snapshotTimeline: {
        type: DataTypes.STRING(100),
      },
      // Notes
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Assignment fields
      salesRepId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "salesReps",
          key: "id",
        },
      },
      employeeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "employees",
          key: "id",
        },
      },
      assignedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "ID of the entity who assigned this lead",
      },
      assignedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Lost Lead Info
      lostReason: {
        type: DataTypes.ENUM(
          "Price Too High",
          "Timeline Mismatch",
          "Chose Competitor",
          "Not Interested",
          "Budget Constraints",
          "Other"
        ),
      },
      customerFeedback: {
        type: DataTypes.TEXT,
      },
      // Unified enquiries (utils/leadPipeline.js): every website enquiry is a lead.
      /** machine · contact · tasting · machine_enquiry · product_quote · landing_page · meta · manual */
      enquiryType: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "machine",
      },
      /** Event id shared with the Campaign Builder lead (lead_submissions.event_id): source + status sync. */
      marketingEventId: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      /** The get_in_touches row this lead was created from (contact / tasting forms). */
      getInTouchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      /** Deal amount when Won (lead revenue in Analytics). */
      wonAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      wonAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "leads",
      timestamps: true,
      indexes: [
        { fields: ["marketingEventId"], name: "leads_marketing_event_idx" },
        { fields: ["getInTouchId"], name: "leads_get_in_touch_idx" },
      ],
    }
  );

  Lead.associate = (models) => {
    // Lead logs
    Lead.hasMany(models.LeadLog);
    models.LeadLog.belongsTo(Lead);

    // Assignment associations
    Lead.belongsTo(models.salesRep, {
      foreignKey: "salesRepId",
      as: "assignedSalesRep",
    });

    Lead.belongsTo(models.employee, {
      foreignKey: "employeeId",
      as: "assignedEmployee",
    });
  };

  return Lead;
};
