require("dotenv").config();
const axios = require("axios");

async function run() {
  const baseUrl = process.env.MARKETING_TEST_BASE_URL || "http://127.0.0.1:8011/api";
  const email = process.env.MARKETING_ADMIN_EMAIL;
  const password = process.env.MARKETING_ADMIN_PASSWORD;

  // eslint-disable-next-line no-console
  console.log(`[smoke] baseUrl=${baseUrl}`);

  const health = await axios.get(`${baseUrl}/health`);
  if (health.status !== 200) throw new Error("Health check failed");

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.log("[smoke] Skipping auth flow: set MARKETING_ADMIN_EMAIL/PASSWORD to enable.");
    return;
  }

  const loginRes = await axios.post(`${baseUrl}/auth/login`, { email, password });
  const token = loginRes?.data?.data?.token;
  if (!token) throw new Error("Login did not return token");

  const meRes = await axios.get(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (meRes.status !== 200) throw new Error("Auth /me failed");

  const slug = `smoke-${Date.now()}`;
  const createdRes = await axios.post(
    `${baseUrl}/admin/landing-pages`,
    {
      title: "Smoke Test Page",
      slug,
      sections: [{ id: "hero-1", type: "hero", visible: true, content: {} }],
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const pageId = createdRes?.data?.data?.id;
  if (!pageId) throw new Error("Failed to create landing page in smoke test");

  const publishRes = await axios.post(
    `${baseUrl}/admin/landing-pages/${pageId}/publish`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (publishRes.status !== 200) throw new Error("Publish endpoint failed");

  const publicRes = await axios.get(`${baseUrl}/public/landing-pages/${slug}`);
  if (publicRes.status !== 200) throw new Error("Public slug endpoint failed");

  const leadRes = await axios.post(`${baseUrl}/public/lead-submissions`, {
    fields: { name: "Smoke User", email: "smoke@example.com" },
    pageUrl: `https://busybeancoffee.com/lp/${slug}`,
    submittedAt: new Date().toISOString(),
    testMode: true,
  });
  if (leadRes.status !== 200) throw new Error("Lead submission endpoint failed");

  const productsRes = await axios.get(`${baseUrl}/admin/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (productsRes.status !== 200) throw new Error("Products list failed");

  const trackingRes = await axios.get(`${baseUrl}/admin/tracking/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (trackingRes.status !== 200) throw new Error("Tracking settings failed");

  const campaignsRes = await axios.get(`${baseUrl}/admin/campaigns`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (campaignsRes.status !== 200) throw new Error("Campaigns list failed");

  const globalSectionsRes = await axios.get(`${baseUrl}/admin/global-sections`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (globalSectionsRes.status !== 200) throw new Error("Global sections list failed");

  const formsRes = await axios.get(`${baseUrl}/admin/forms`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (formsRes.status !== 200) throw new Error("Forms list failed");

  const templatesRes = await axios.get(`${baseUrl}/admin/templates/custom`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (templatesRes.status !== 200) throw new Error("Custom templates list failed");

  const seedStatusRes = await axios.get(`${baseUrl}/admin/seed/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (seedStatusRes.status !== 200 || !seedStatusRes?.data?.data?.modules) {
    throw new Error("Seed status endpoint failed");
  }

  // eslint-disable-next-line no-console
  console.log(
    "[smoke] health + auth + landing-page + publish + public + lead + phase2 lists passed",
  );
}

if (require.main === module) {
  run()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("[smoke] done");
    })
    .catch((error) => {
      const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      // eslint-disable-next-line no-console
      console.error("[smoke] failed:", detail);
      process.exit(1);
    });
}

module.exports = { run };
