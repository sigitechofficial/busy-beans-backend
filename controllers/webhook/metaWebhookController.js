/**
 * Meta (Facebook/Instagram) Lead Ads Webhook Handler
 *
 * This controller handles webhooks from Meta Lead Ads to automatically create leads
 * in the system when someone submits a form on Facebook or Instagram.
 *
 * Required Environment Variables:
 * - META_VERIFY_TOKEN: Token used for webhook verification (set in Meta App settings)
 * - META_ACCESS_TOKEN: Access token for Meta Graph API (to fetch lead details)
 *
 * Webhook Setup:
 * 1. Go to Meta for Developers: https://developers.facebook.com/
 * 2. Create/Select your app
 * 3. Go to Webhooks section
 * 4. Subscribe to "leadgen" object
 * 5. Set callback URL: https://yourdomain.com/webhook/meta-leads
 * 6. Set verify token (must match META_VERIFY_TOKEN)
 *
 * Routes:
 * - GET /webhook/meta-leads - Webhook verification endpoint
 * - POST /webhook/meta-leads - Lead data reception endpoint
 */

const { Lead, sequelize } = require("../../models");
const sendCustomerEmail = require("../../helper/coffeeMachineQuotation");
const sendAdminEmail = require("../../helper/coffeeMachineQuotationAdmin");
const { createLeadLog, formatLogDetails } = require("../../utils/leadLogger");
const { sendIfAllowed, leadPerson, hqPerson } = require("../../utils/emailSendGate");

// Meta webhook verification token - should match what's configured in Meta App settings
const META_VERIFY_TOKEN =
  process.env.META_VERIFY_TOKEN || "your_meta_verify_token_here";

/**
 * Handle Meta webhook verification (GET request)
 * Meta sends a GET request to verify the webhook endpoint
 */
exports.verifyMetaWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔐 Meta webhook verification request:", {
    mode,
    token: token ? "***" : "missing",
    challenge: challenge ? "present" : "missing",
  });

  // Verify the mode and token
  if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
    console.log("✅ Meta webhook verified successfully");
    // Respond with the challenge token
    res.status(200).send(challenge);
  } else {
    console.error("❌ Meta webhook verification failed");
    res.status(403).send("Forbidden");
  }
};

/**
 * Handle Meta lead generation webhook (POST request)
 * This receives lead data when someone submits a Meta Lead Ad form
 */
exports.handleMetaLeadWebhook = async (req, res) => {
  try {
    const body = req.body;

    console.log("📥 Meta webhook received:", JSON.stringify(body, null, 2));

    // Meta sends webhook data in the format:
    // {
    //   "entry": [
    //     {
    //       "id": "page_id",
    //       "time": timestamp,
    //       "changes": [
    //         {
    //           "value": {
    //             "leadgen_id": "lead_id",
    //             "page_id": "page_id",
    //             "form_id": "form_id",
    //             "created_time": timestamp,
    //             "ad_id": "ad_id",
    //             "ad_name": "ad_name",
    //             "adset_id": "adset_id",
    //             "adset_name": "adset_name",
    //             "campaign_id": "campaign_id",
    //             "campaign_name": "campaign_name"
    //           },
    //           "field": "leadgen"
    //         }
    //       ]
    //     }
    //   ],
    //   "object": "page"
    // }

    // Respond immediately to Meta (within 20 seconds)
    res.status(200).json({ received: true });

    // Process the webhook asynchronously
    if (body.object === "page" && body.entry) {
      for (const entry of body.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.field === "leadgen" && change.value) {
              await processMetaLead(change.value);
            }
          }
        }
      }
    } else {
      console.log("⚠️ Unexpected webhook format from Meta");
    }
  } catch (error) {
    console.error("❌ Error handling Meta webhook:", error);
    // Already sent response, so just log the error
  }
};

/**
 * Process a Meta lead by fetching lead details and creating a Lead record
 * @param {Object} leadData - Lead data from Meta webhook
 */
const processMetaLead = async (leadData) => {
  const transaction = await sequelize.transaction();

  try {
    const leadgenId = leadData.leadgen_id;

    if (!leadgenId) {
      console.error("❌ No leadgen_id found in webhook data");
      return;
    }

    console.log("🔄 Processing Meta lead:", leadgenId);

    // Fetch the actual lead data from Meta Graph API
    let metaLeadDetails = null;
    let mappedLeadData = {
      contactName: "Meta Lead",
      contactEmail: null,
      contactPhone: null,
      company: "N/A",
    };

    // Try to fetch detailed lead information from Meta Graph API
    const accessToken = process.env.META_ACCESS_TOKEN;
    if (accessToken) {
      try {
        metaLeadDetails = await fetchMetaLeadDetails(leadgenId, accessToken);
        mappedLeadData = mapMetaLeadToModel(metaLeadDetails);
        console.log("✅ Fetched Meta lead details successfully");
      } catch (fetchError) {
        console.error(
          "⚠️ Error fetching Meta lead details, using webhook data only:",
          fetchError.message
        );
        // Continue with placeholder data if API call fails
      }
    } else {
      console.warn(
        "⚠️ META_ACCESS_TOKEN not set, cannot fetch detailed lead information"
      );
    }

    // Determine lead source based on ad/platform
    // Lead model ENUM supports: "Instagram", "Website", "Referral", "Cold Call", "WhatsApp", "Other"
    // Use "Instagram" for Instagram leads, "Other" for Facebook leads
    let leadSource = "Instagram";
    let platform = "Instagram";

    if (leadData.campaign_name || leadData.ad_name) {
      const campaignLower = (leadData.campaign_name || "").toLowerCase();
      const adLower = (leadData.ad_name || "").toLowerCase();
      if (campaignLower.includes("facebook") || adLower.includes("facebook")) {
        platform = "Facebook";
        leadSource = "Other"; // Facebook leads use "Other" since it's not in ENUM
      } else if (
        campaignLower.includes("instagram") ||
        adLower.includes("instagram")
      ) {
        platform = "Instagram";
        leadSource = "Instagram";
      }
    }

    // Map Meta lead data to our Lead model
    const leadModelData = {
      // Basic Info
      company: mappedLeadData.company || leadData.campaign_name || "N/A",
      contactName: mappedLeadData.contactName || "Meta Lead",
      contactEmail: mappedLeadData.contactEmail,
      contactPhone: mappedLeadData.contactPhone,

      // Address Info (if available)
      addressLineOne: mappedLeadData.addressLineOne,
      city: mappedLeadData.city,
      state: mappedLeadData.state,
      country: mappedLeadData.country,
      zipCode: mappedLeadData.zipCode,

      // Lead Source
      leadSource: leadSource,

      // Lead Tracking
      leadDate: leadData.created_time
        ? new Date(leadData.created_time * 1000)
        : new Date(),

      // Status
      status: "New Enquiry",
      tag: "Warm Lead",

      // Notes - combine Meta metadata with any form notes
      notes: `${mappedLeadData.notes ? mappedLeadData.notes + "\n\n" : ""}${platform} Lead Ad Details:
- Platform: ${platform}
- Lead ID: ${leadgenId}
- Form ID: ${leadData.form_id || "N/A"}
- Ad ID: ${leadData.ad_id || "N/A"}
- Ad Name: ${leadData.ad_name || "N/A"}
- Campaign: ${leadData.campaign_name || "N/A"}
- Adset: ${leadData.adset_name || "N/A"}
- Created: ${leadData.created_time ? new Date(leadData.created_time * 1000).toISOString() : "N/A"}`,
    };

    const newLead = await Lead.create(leadModelData, { transaction });

    // Log lead creation
    await createLeadLog({
      leadId: newLead.id,
      action: "created",
      details: formatLogDetails("created", {}, "Meta Lead Ads Webhook"),
      user: null, // No user for webhook-created leads
      type: "status",
      transaction,
    });

    await transaction.commit();

    console.log("✅ Meta lead created successfully:", newLead.id);

    // Prepare email data - map to expected format
    const emailData = {
      contactName: leadModelData.contactName,
      contactEmail: leadModelData.contactEmail,
      contactPhone: leadModelData.contactPhone,
      company: leadModelData.company,
      notes: leadModelData.notes,
    };

    // Send email notifications (only if email is available)
    if (emailData.contactEmail) {
      try {
        await sendIfAllowed({
          ...leadPerson(),
          emailType: "coffee_machine_customer",
          recipients: emailData.contactEmail,
          send: async () => sendCustomerEmail({ data: emailData }),
        });
        await sendIfAllowed({
          ...hqPerson(),
          emailType: "coffee_machine_admin",
          recipients: "sigidevelopers@gmail.com",
          send: async () => sendAdminEmail({ data: emailData }),
        });
      } catch (emailError) {
        console.error("⚠️ Error sending emails:", emailError);
        // Don't fail the webhook if email fails
      }
    } else {
      console.log("⚠️ No email found, skipping email notifications");
    }

    return newLead;
  } catch (error) {
    await transaction.rollback();
    console.error("❌ Error processing Meta lead:", error);
    throw error;
  }
};

/**
 * Fetch detailed lead information from Meta Graph API
 * This should be called to get the actual form field values
 * @param {string} leadgenId - The lead ID from Meta
 * @param {string} accessToken - Meta Graph API access token
 * @returns {Promise<Object>} - Lead data with form fields
 */
const fetchMetaLeadDetails = async (leadgenId, accessToken) => {
  try {
    const axios = require("axios");
    const url = `https://graph.facebook.com/v18.0/${leadgenId}`;
    const params = {
      access_token: accessToken,
    };

    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching Meta lead details:", error);
    throw error;
  }
};

/**
 * Map Meta lead form fields to Lead model
 * Meta forms can have custom fields, so this needs to be customized
 * @param {Object} metaLeadData - Lead data from Meta Graph API
 * @returns {Object} - Mapped data for Lead model
 */
const mapMetaLeadToModel = (metaLeadData) => {
  // Meta returns field_data array with objects like:
  // { name: "full_name", values: ["John Doe"] }
  // { name: "email", values: ["john@example.com"] }
  // { name: "phone_number", values: ["+1234567890"] }

  const fieldMap = {};
  if (metaLeadData.field_data && Array.isArray(metaLeadData.field_data)) {
    metaLeadData.field_data.forEach((field) => {
      if (field.values && field.values.length > 0) {
        fieldMap[field.name] = field.values[0];
      }
    });
  }

  return {
    contactName:
      fieldMap.full_name || fieldMap.first_name || fieldMap.name || "Meta Lead",
    contactEmail: fieldMap.email || null,
    contactPhone: fieldMap.phone_number || fieldMap.phone || null,
    company: fieldMap.company_name || fieldMap.company || "N/A",
    addressLineOne: fieldMap.address || fieldMap.street || null,
    city: fieldMap.city || null,
    state: fieldMap.state || fieldMap.province || null,
    country: fieldMap.country || null,
    zipCode: fieldMap.zip_code || fieldMap.postal_code || null,
    notes: fieldMap.notes || fieldMap.message || fieldMap.comments || null,
  };
};
