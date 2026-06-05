require("dotenv").config();
const bcrypt = require("bcryptjs");
const { getMarketingUserModel } = require("../models/marketingUser");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

async function seedMarketingAdmin() {
  const MarketingUser = getMarketingUserModel();
  const email = String(process.env.MARKETING_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.MARKETING_ADMIN_PASSWORD || "").trim();
  const name = String(process.env.MARKETING_ADMIN_NAME || "Marketing Admin").trim();
  const role = String(process.env.MARKETING_ADMIN_ROLE || "Super Admin").trim();
  const id = String(process.env.MARKETING_ADMIN_ID || "user_marketing_admin").trim();

  if (!email || !password) {
    throw new Error(
      "Set MARKETING_ADMIN_EMAIL and MARKETING_ADMIN_PASSWORD before running marketing seed.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user, created] = await MarketingUser.findOrCreate({
    where: { email },
    defaults: {
      id,
      email,
      password_hash: passwordHash,
      name,
      role,
    },
  });

  if (!created) {
    user.password_hash = passwordHash;
    user.name = name;
    user.role = role;
    await user.save();
  }

  return { id: user.id, email: user.email, created };
}

if (require.main === module) {
  seedMarketingAdmin()
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log("Marketing admin seed complete:", result);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Marketing admin seed failed:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      const sequelize = getMarketingSequelize();
      await sequelize.close();
    });
}

module.exports = { seedMarketingAdmin };
