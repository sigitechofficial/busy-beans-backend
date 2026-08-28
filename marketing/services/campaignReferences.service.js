const { Op } = require("sequelize");
const { getCampaignModel } = require("../models/campaign");

async function getCampaignsReferencingLandingPage(page) {
  try {
    const Campaign = getCampaignModel();
    const slugPath = `/lp/${page.slug}`;

    const rows = await Campaign.findAll({
      where: {
        status: { [Op.ne]: "archived" },
        [Op.or]: [
          { linkedLandingPageId: page.id },
          { destinationUrl: { [Op.like]: `%${slugPath}%` } },
        ],
      },
      attributes: ["id", "name", "status"],
    });

    return rows.map((r) => ({ id: r.id, name: r.name, status: r.status }));
  } catch {
    // campaigns table may not exist yet on older environments
    return [];
  }
}

module.exports = { getCampaignsReferencingLandingPage };
