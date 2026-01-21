// services/qboCustomerService.js
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { handleQboError } = require("./qboErrorHandler");
const {
  user,
  salesRep,
  address,
  billingAddress,
  qboCustomerMap,
  account,
} = require("../models");
const axios = require("axios");

const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR = 70;

// ✅ FINAL — DISPLAY NAME FUNCTION (core logic)
function getDisplayName(u) {
  // ✅ Customer → use companyName
  if (u.companyName) return u.companyName.trim();

  // ✅ Local-partner → srName + territoryName
  const sn = (u.srName || "").trim();
  const tn = (u.territoryName || "").trim();
  const combined = `${sn} ${tn}`.trim();
  if (combined) return combined;

  // ✅ fallback (kabhi empty na ho)
  return (u.email || "").trim();
}

// ✅ Map local user → QBO Customer payload
function mapToQboCustomer(u) {
  return {
    DisplayName: getDisplayName(u), // ✅ ALWAYS CONSISTENT
    PrimaryEmailAddr: u.email ? { Address: u.email } : undefined,
    GivenName: u.name,
    CompanyName: u.companyName || undefined,
    PrimaryPhone: formatPhone(u.countryCode, u.phoneNumber),

    BillAddr: u.billingAddresses?.[0]
      ? {
          Line1: u.billingAddresses[0].addressLineOne,
          Line2: u.billingAddresses[0].addressLineTwo,
          City: u.billingAddresses[0].city,
          CountrySubDivisionCode: u.billingAddresses[0].state,
          PostalCode: u.billingAddresses[0].zipCode,
          Country: u.billingAddresses[0].country,
        }
      : undefined,

    ShipAddr: u.addresses?.[0]
      ? {
          Line1: u.addresses[0].addressLineOne,
          Line2: u.addresses[0].addressLineTwo,
          City: u.addresses[0].city,
          CountrySubDivisionCode: u.addresses[0].state,
          PostalCode: u.addresses[0].zipCode,
          Country: u.addresses[0].country,
        }
      : undefined,
  };
}

function escapeQboValue(str = "") {
  // Escape single quotes by doubling them (SQL standard)
  return str.replace(/'/g, "''").trim();
}

const formatPhone = (countryCode, number) => {
  if (!number) return undefined;
  const formatted = countryCode
    ? `+${countryCode.replace(/\D/g, "")} ${number}`
    : number;
  return { FreeFormNumber: formatted };
};

// ✅ **ONLY DISPLAYNAME SEARCH** (as you ordered)
// Enhanced to handle apostrophes and case-insensitive search
async function findQboCustomerByDisplayName({
  accessToken,
  realmId,
  displayName,
}) {
  const headers = { Authorization: `Bearer ${accessToken}` };

  if (!displayName) return null;

  // Strategy 1: Try exact match (case-sensitive) with escaped apostrophe
  const safe = escapeQboValue(displayName);
  let q = encodeURIComponent(
    `select Id, DisplayName from Customer where DisplayName='${safe}'`
  );

  let url = `${QBO(realmId)}/query?query=${q}&minorversion=${MINOR}`;
  console.log(
    "🔍 [QBO Search] Attempt 1 - Exact match query:",
    decodeURIComponent(q)
  );

  let r = await axios.get(url, {
    headers,
    validateStatus: () => true,
  });

  let found = r.data?.QueryResponse?.Customer?.[0];

  // Strategy 2: If not found, try case-insensitive search using UPPER()
  if (!found) {
    const safeUpper = escapeQboValue(displayName.toUpperCase());
    q = encodeURIComponent(
      `select Id, DisplayName from Customer where UPPER(DisplayName)='${safeUpper}'`
    );

    url = `${QBO(realmId)}/query?query=${q}&minorversion=${MINOR}`;
    console.log(
      "🔍 [QBO Search] Attempt 2 - Case-insensitive query:",
      decodeURIComponent(q)
    );

    r = await axios.get(url, {
      headers,
      validateStatus: () => true,
    });

    found = r.data?.QueryResponse?.Customer?.[0];
  }

  // Strategy 3: If still not found and name contains apostrophe, try variations
  if (!found && displayName.includes("'")) {
    // Try searching with different apostrophe characters
    const apostropheVariations = [
      "'", // straight apostrophe
      "'", // right single quotation mark
      "'", // left single quotation mark
    ];

    for (const apostropheChar of apostropheVariations) {
      const testName = displayName.replace(/'/g, apostropheChar);
      const safe = escapeQboValue(testName);
      q = encodeURIComponent(
        `select Id, DisplayName from Customer where DisplayName='${safe}'`
      );

      url = `${QBO(realmId)}/query?query=${q}&minorversion=${MINOR}`;
      console.log(
        `🔍 [QBO Search] Attempt 3 - Testing apostrophe variation:`,
        decodeURIComponent(q)
      );

      r = await axios.get(url, {
        headers,
        validateStatus: () => true,
      });

      found = r.data?.QueryResponse?.Customer?.[0];
      if (found) break;
    }

    // If still not found, try LIKE with parts split by apostrophe
    if (!found) {
      const parts = displayName.split("'");
      if (parts.length === 2) {
        // Name like "Marriott's Royal Palms" -> search for "Marriott" and "Royal Palms"
        const part1 = escapeQboValue(parts[0].trim());
        const part2 = escapeQboValue(parts[1].trim());
        q = encodeURIComponent(
          `select Id, DisplayName from Customer where DisplayName LIKE '${part1}%${part2}%'`
        );

        url = `${QBO(realmId)}/query?query=${q}&minorversion=${MINOR}`;
        console.log(
          "🔍 [QBO Search] Attempt 3b - LIKE pattern (split apostrophe):",
          decodeURIComponent(q)
        );

        r = await axios.get(url, {
          headers,
          validateStatus: () => true,
        });

        const customers = r.data?.QueryResponse?.Customer || [];
        if (customers.length > 0) {
          // Find exact match
          found = customers.find(
            (c) =>
              c.DisplayName?.toLowerCase() === displayName.toLowerCase() ||
              c.DisplayName === displayName
          );
          // If no exact match, take the first one
          if (!found && customers.length > 0) {
            found = customers[0];
          }
        }
      }
    }
  }

  // Strategy 4: Try searching by first word (for names with apostrophes) - more efficient
  if (!found && displayName.includes("'")) {
    console.log("🔍 [QBO Search] Attempt 4 - Searching by first word...");

    // Get the first word before apostrophe (e.g., "Marriott" from "Marriott's Royal Palms")
    const firstWord = displayName.split(/['\s]/)[0].trim();
    if (firstWord) {
      const safeFirst = escapeQboValue(firstWord);
      q = encodeURIComponent(
        `select Id, DisplayName from Customer where DisplayName LIKE '${safeFirst}%' MAXRESULTS 50`
      );

      url = `${QBO(realmId)}/query?query=${q}&minorversion=${MINOR}`;
      console.log(
        "🔍 [QBO Search] Attempt 4 - First word search:",
        decodeURIComponent(q)
      );

      r = await axios.get(url, {
        headers,
        validateStatus: () => true,
      });

      const customers = r.data?.QueryResponse?.Customer || [];
      if (customers.length > 0) {
        const displayNameLower = displayName.toLowerCase().trim();

        // Find exact match or match with normalized apostrophes
        found = customers.find((c) => {
          if (!c.DisplayName) return false;
          const qboName = c.DisplayName.toLowerCase().trim();
          // Exact match
          if (qboName === displayNameLower) return true;
          // Match ignoring apostrophe variations (straight vs curly)
          const normalizedQbo = qboName.replace(/[''']/g, "'");
          const normalizedSearch = displayNameLower.replace(/[''']/g, "'");
          return normalizedQbo === normalizedSearch;
        });
      }
    }
  }

  console.log("🚀 ~ findQboCustomerByDisplayName ~ displayName:", displayName);
  console.log("🚀 ~ findQboCustomerByDisplayName ~ found:", found);

  return found || null;
}

async function upsertQboCustomer({ u, condition, userType }) {
  try {
    const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
      condition,
    });

    if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

    const displayName = getDisplayName(u);
    const existing = await findQboCustomerByDisplayName({
      accessToken,
      realmId,
      displayName,
    });
    console.log("🚀 ~ upsertQboCustomer ~ existing:", existing);
    if (existing?.Id) {
      const qboCustomerId = existing.Id;
      //   await updateQboCustomerId(u, qboCustomerId, userType);
      return qboCustomerId;
    }

    const payload = mapToQboCustomer(u);
    const res = await axios.post(
      `${QBO(realmId)}/customer?minorversion=${MINOR}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    const qboCustomerId = res.data?.Customer?.Id;
    // if (qboCustomerId) {
    //   await updateQboCustomerId(u, qboCustomerId, userType);
    // }

    return qboCustomerId;
  } catch (err) {
    // Handle duplicate name error specifically
    if (
      err?.response?.data?.Fault?.Error?.[0]?.code === "6240" ||
      err?.response?.data?.Fault?.Error?.[0]?.Message?.includes(
        "Duplicate Name"
      )
    ) {
      console.log(
        "⚠️ [QBO] Duplicate name detected, attempting to find existing customer..."
      );

      const displayName = getDisplayName(u);
      // Try to find the customer again (maybe it was created between search and create)
      try {
        const { accessToken: retryToken, realmId: retryRealmId } =
          await refreshAccessTokenIfNeeded({
            condition,
          });

        if (retryToken && retryRealmId) {
          const existing = await findQboCustomerByDisplayName({
            accessToken: retryToken,
            realmId: retryRealmId,
            displayName,
          });

          if (existing?.Id) {
            console.log(
              "✅ [QBO] Found existing customer after duplicate error:",
              existing.Id
            );
            return existing.Id;
          }
        }
      } catch (retryErr) {
        console.error(
          "❌ [QBO] Error during retry search after duplicate error:",
          retryErr.message
        );
      }

      // If still not found, log and return null (don't throw to allow import to continue)
      console.error(
        "❌ [QBO] Duplicate name error but customer not found in search. DisplayName:",
        displayName
      );
      handleQboError({
        err,
        context: `[QBO][Customer] ----❌ upsertQboCustomer (duplicate name):`,
      });
      return null; // Return null instead of throwing to allow import to continue
    }

    // For other errors, log and throw
    handleQboError({
      err,
      context: `[QBO][Customer] ----❌ upsertQboCustomer:`,
    });
    throw err; // Re-throw to let caller handle
  }
}

async function updateQboCustomerId(u, qboCustomerId, userType) {
  const MODEL = userType === "local-partner" ? salesRep : user;
  const input = { qboCustomerId };

  if (MODEL === user && u.salesRep?.partnerType === "direct-partner") {
    input.qboCustomerIdForPartner = qboCustomerId;
    delete input.qboCustomerId;
  }

  await MODEL.update(input, { where: { id: u.id } });
}

// ✅ MAIN IMPORT FUNCTION (fixed, clean, consistent)
async function importCustomersToQuickBooks({
  limitIds = [],
  userType = "customer",
  req,
}) {
  console.log("🚀 ~ importCustomersToQuickBooks ~ limitIds:", limitIds);
  console.log("🚀 ~ importCustomersToQuickBooks ~ limitIds:", limitIds);
  console.log("🚀 ~ importCustomersToQuickBooks ~ limitIds:", userType);

  // Delete any records in qboCustomerMap where qboCustomerId is null
  await qboCustomerMap.destroy({
    where: {
      qboCustomerId: null,
    },
  });

  const where = {};
  if (limitIds.length) where.id = limitIds;

  const MODEL = userType === "local-partner" ? salesRep : user;
  const include = [
    { model: address, limit: 1 },
    { model: billingAddress, limit: 1 },
  ];

  let ADMIN = await account.findOne({});
  if (MODEL === user) {
    include.push({
      model: salesRep,
      attributes: [
        "id",
        "srName",
        "territoryName",
        "partnerType",
        "currentRealmId",
      ],
    });
  }

  const users = await MODEL.findAll({ where, include });

  console.log(
    `[QBO][CustomerImport] Found ${users.length} user(s) to import.`,
    JSON.parse(JSON.stringify(users))
  );

  const results = [];

  for (const u of users) {
    console.log(`\n-----------------------------`);
    console.log(`[QBO][Customer] Processing user ${u.id} (${u.email})`);

    try {
      // --- (1) Always export to ADMIN realm
      const adminCondition = {
        accountId: ADMIN?.id,
        realmId: ADMIN?.currentRealmId,
      };

      const existCondition = { ...adminCondition };
      if (userType == "local-partner") {
        existCondition.salesRepId = u.id;
      } else if (userType == "customer") {
        existCondition.userId = u.id;
      }
      console.log(
        "🚀 ~ importCustomersToQuickBooks ~ existCondition:",
        existCondition
      );
      const alreadyExist = await qboCustomerMap.findOne({
        where: existCondition,
      });

      if (alreadyExist) {
        console.log(
          "🚀 ~ importCustomersToQuickBooks ~ Customer Already On Admin QBO:"
        );
      } else {
        const adminCustomerId = await upsertQboCustomer({
          u,
          condition: adminCondition, // pass condition instead of token
          userType,
        });

        // Only create mapping if we got a valid customer ID
        if (adminCustomerId) {
          const adminInput = {
            ...adminCondition,
            qboCustomerId: adminCustomerId,
          };

          if (userType == "customer") {
            adminInput.userId = u.id;
          } else {
            adminInput.salesRepId = u.id;
          }

          console.log(
            "🚀 ~ importCustomersToQuickBooks ~ adminInput:",
            adminInput
          );
          await qboCustomerMap.create(adminInput);
          results.push(adminInput);
        } else {
          console.log(
            `⚠️ [QBO] Failed to create/find customer for ${u.email}, skipping...`
          );
        }
      }

      // --- (2) If customer belongs to a sales rep, export to partner too
      if (
        userType === "customer" &&
        u.salesRepId &&
        u.salesRep?.currentRealmId
      ) {
        try {
          const repCondition = {
            salesRepId: u.salesRepId,
            realmId: u.salesRep.currentRealmId,
          };

          const exisit = await qboCustomerMap.findOne({
            where: { ...repCondition, userid: u.id },
          });

          if (exisit) {
            console.log(
              "🚀 ~ importCustomersToQuickBooks ~ Customer Already On Partner QBO:",
              exisit
            );
          } else {
            const partnerCustomerId = await upsertQboCustomer({
              u,
              condition: repCondition,
              userType,
            });

            // Only create mapping if we got a valid customer ID
            if (partnerCustomerId) {
              const partnerInput = {
                ...repCondition,
                qboCustomerId: partnerCustomerId,
                userId: u?.id,
              };
              console.log(
                "🚀 ~ importCustomersToQuickBooks ~ partnerInput:",
                partnerInput
              );
              await qboCustomerMap.create(partnerInput);
              results.push(partnerInput);
            } else {
              console.log(
                `⚠️ [QBO] Failed to create/find partner customer for ${u.email}, skipping...`
              );
            }
          }
        } catch (partnerErr) {
          handleQboError({
            err: partnerErr,
            context: `[QBO][Customer] ⚠️ Partner sync failed for ${u?.email}`,
          });
        }
      }
    } catch (adminErr) {
      handleQboError({
        err: adminErr,
        context: `[QBO][Customer] ⚠️ Admin sync failed for ${u?.email}`,
      });
    }
  }

  console.log(
    `[QBO][CustomerImport] ✅ Completed import for ${results.length} user(s).`,
    results
  );

  return { imported: results.length, results };
}

module.exports = { importCustomersToQuickBooks };
