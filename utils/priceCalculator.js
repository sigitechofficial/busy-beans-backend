/**
 * Price Calculator Service
 * Calculates total subscription price from machine and add-ons
 */

/**
 * Calculate the total price for a subscription
 * @param {Object} params - Calculation parameters
 * @param {Object} params.machine - Coffee machine object with price
 * @param {Array} params.addons - Array of addon objects with price
 * @returns {Object} Price breakdown
 */
function calculateSubscriptionPrice({ machine, addons = [] }) {
  // Validate machine
  if (!machine || !machine.price) {
    throw new Error("Machine with price is required");
  }

  const machinePrice = parseFloat(machine.price);

  // Calculate total addon price
  let addonTotal = 0;
  const addonDetails = [];

  for (const addon of addons) {
    const addonPrice = parseFloat(addon.price);
    addonTotal += addonPrice;

    addonDetails.push({
      id: addon.id,
      name: addon.name,
      price: addonPrice,
    });
  }

  const total = machinePrice + addonTotal;

  return {
    total: parseFloat(total.toFixed(2)),
    breakdown: {
      machine: parseFloat(machinePrice.toFixed(2)),
      addons: parseFloat(addonTotal.toFixed(2)),
      addonDetails,
    },
  };
}

/**
 * Convert price to cents for Stripe
 * @param {number} amount - Amount in dollars
 * @returns {number} Amount in cents
 */
function toCents(amount) {
  return Math.round(amount * 100);
}

/**
 * Convert cents to dollars
 * @param {number} cents - Amount in cents
 * @returns {number} Amount in dollars
 */
function toDollars(cents) {
  return parseFloat((cents / 100).toFixed(2));
}

module.exports = {
  calculateSubscriptionPrice,
  toCents,
  toDollars,
};
