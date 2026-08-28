require("dotenv").config();
const axios = require("axios");

async function main() {
  const baseUrl = process.env.MARKETING_TEST_BASE_URL || "http://127.0.0.1:8011/api";
  const email = process.env.MARKETING_ADMIN_EMAIL;
  const password = process.env.MARKETING_ADMIN_PASSWORD;

  const loginRes = await axios.post(`${baseUrl}/auth/login`, { email, password });
  const token = loginRes.data.data.token;
  const slug = `smoke-${Date.now()}`;

  try {
    const createdRes = await axios.post(
      `${baseUrl}/admin/landing-pages`,
      {
        title: "Smoke Test Page",
        slug,
        sections: [
          { id: "hero-1", type: "hero", visible: true, content: {} },
          { id: "cta-1", type: "cta-banner", visible: true, content: {} },
        ],
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    console.log("create ok", createdRes.data.data.id);
    console.log(
      "create draftSections count",
      Array.isArray(createdRes.data.data.draftSections)
        ? createdRes.data.data.draftSections.length
        : createdRes.data.data.draft_sections?.length,
    );
    const pageId = createdRes.data.data.id;

    const getRes = await axios.get(`${baseUrl}/admin/landing-pages/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(
      "get draftSections count",
      Array.isArray(getRes.data.data.draftSections)
        ? getRes.data.data.draftSections.length
        : getRes.data.data.draft_sections?.length,
    );

    const validateRes = await axios.get(
      `${baseUrl}/admin/landing-pages/${pageId}/validate`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    console.log("validate", JSON.stringify(validateRes.data.data));

    const publishRes = await axios.post(
      `${baseUrl}/admin/landing-pages/${pageId}/publish`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    console.log("publish ok", publishRes.status);
  } catch (error) {
    console.log("failed", error.response?.status, JSON.stringify(error.response?.data, null, 2));
  }
}

main();
