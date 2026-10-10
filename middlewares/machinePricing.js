const { coffeeMachine } = require("../models");
const catchAsync = require("../utils/catchAsync");

const PRICE_KEYS = new Set(["price", "pricePer"]);

function stripPrices(value) {
  if (Array.isArray(value)) return value.map(stripPrices);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const plain = typeof value.toJSON === "function" ? value.toJSON() : value;
    if (plain !== value) return stripPrices(plain);
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (!PRICE_KEYS.has(key)) out[key] = stripPrices(v);
    }
    return out;
  }
  return value;
}

/**
 * Public coffee-machine endpoints (/api/v1/users/coffee-machine): the websites never show machine
 * prices, so `price` / `pricePer` are never returned. The admin panel manages machines and their
 * prices through /api/v1/admin/coffee-machine (staff only).
 */
exports.hideMachinePrices = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => json(stripPrices(body));
  next();
};

/**
 * Machine enquiry leads (/api/v1/users/create-lead): the website no longer knows the machine price,
 * so the lead's estimated value is taken from the machine on the server.
 */
exports.fillMachineLeadValue = catchAsync(async (req, res, next) => {
  const body = req.body || {};
  const machineId = Number.parseInt(body.machineId, 10);
  if (Number.isFinite(machineId) && machineId > 0 && !(Number(body.estimatedValue) > 0)) {
    const machine = await coffeeMachine.findByPk(machineId, { attributes: ["id", "price"] });
    if (machine && Number(machine.price) > 0) body.estimatedValue = Number(machine.price);
  }
  next();
});

exports.stripPrices = stripPrices;
