// Example: How to create a subscription using the API

const axios = require("axios");

const API_BASE = "http://localhost:3000";

async function createSubscription() {
  try {
    const response = await axios.post(`${API_BASE}/api/subscription/create`, {
      customerEmail: "test@busybeans.com",
      paymentMethodId: "pm_card_visa", // Stripe test payment method
      machineId: 1, // Make sure coffeeMachine with id=1 exists
      addonIds: [1, 2, 3], // Make sure these addon IDs exist
    });

    console.log("✅ Subscription created:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

async function getSubscription(subscriptionId) {
  try {
    const response = await axios.get(
      `${API_BASE}/api/subscription/${subscriptionId}`
    );
    console.log("✅ Subscription details:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

async function listAddons() {
  try {
    const response = await axios.get(`${API_BASE}/api/subscription/addons`);
    console.log("✅ Available add-ons:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

async function cancelSubscription(subscriptionId) {
  try {
    const response = await axios.post(
      `${API_BASE}/api/subscription/${subscriptionId}/cancel`
    );
    console.log("✅ Subscription canceled:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

// Run examples
async function main() {
  console.log("🚀 Testing Subscription API...\n");

  // 1. List available add-ons
  console.log("1️⃣ Listing add-ons...");
  await listAddons();
  console.log("\n");

  // 2. Create a subscription
  console.log("2️⃣ Creating subscription...");
  const result = await createSubscription();
  console.log("\n");

  if (result && result.subscriptionId) {
    // 3. Get subscription details
    console.log("3️⃣ Getting subscription details...");
    await getSubscription(result.subscriptionId);
    console.log("\n");

    // 4. Cancel subscription (optional - uncomment to test)
    // console.log('4️⃣ Canceling subscription...');
    // await cancelSubscription(result.subscriptionId);
  }
}

// Uncomment to run:
// main();

module.exports = {
  createSubscription,
  getSubscription,
  listAddons,
  cancelSubscription,
};
