/**
 * Stripe webhook signature verification uses the environment secret only
 * (STRIPE_WEBHOOK_SECERET) — no hard-coded fallback.
 *   node scripts/stripeWebhookSecretTest.js
 * Runs the handler in child processes (the secret is read when the module loads) with a
 * throw-away test secret; nothing is sent to Stripe and no event is processed (unhandled type).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const TEST_SECRET = `whsec_test_${Date.now()}`; // generated per run, not a real secret

function child() {
  // Capture logs before the controller loads (it logs its configuration at load time).
  const log = console.log;
  const err = console.error;
  const logs = [];
  console.log = (...a) => logs.push(a.join(" "));
  console.error = (...a) => logs.push(a.join(" "));
  const stripe = require("stripe")("sk_test_unused");
  const controller = require(path.join(__dirname, "../controllers/webhook/webhookController"));
  const payload = JSON.stringify({ id: "evt_test", object: "event", type: "test.unhandled", data: { object: {} } });
  const signWith = process.env.SIGN_WITH;
  const header = signWith
    ? stripe.webhooks.generateTestHeaderString({ payload, secret: signWith })
    : "t=1,v1=invalid";
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    json(body) { this.body = body; return this; },
  };
  Promise.resolve(controller.stripeSubscriptionWebhookEventHandler({ headers: { "stripe-signature": header }, body: Buffer.from(payload) }, res))
    .then(() => {
      console.log = log;
      console.error = err;
      const secret = process.env.STRIPE_WEBHOOK_SECERET;
      const leaked = Boolean(secret) && logs.some((l) => l.includes(secret));
      process.stdout.write(`${JSON.stringify({ status: res.statusCode, body: res.body, leaked, configuredLog: logs.find((l) => l.startsWith("Stripe webhook configured")) })}\n`);
      process.exit(0);
    })
    .catch((e) => {
      console.error = err;
      console.error(e.message);
      process.exit(2);
    });
}

function run(env) {
  const r = spawnSync(process.execPath, [__filename, "--child"], {
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 120000,
  });
  const line = (r.stdout || "").trim().split("\n").filter((l) => l.startsWith("{")).pop();
  if (!line) throw new Error(`child failed: ${(r.stderr || "").slice(-300)}`);
  return JSON.parse(line);
}

let failures = 0;
function check(ok, label) {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
}

if (process.argv.includes("--child")) {
  child();
} else {
  // Empty value: dotenv never overrides an existing variable, so this simulates "not configured".
  const missing = run({ STRIPE_WEBHOOK_SECERET: "", SIGN_WITH: TEST_SECRET });
  check(missing.status === 500 && missing.body === "Webhook verification unavailable.", "secret missing → controlled 500, event not processed");
  check(missing.configuredLog === "Stripe webhook configured: no", "startup log says configured: no");

  const wrong = run({ STRIPE_WEBHOOK_SECERET: TEST_SECRET, SIGN_WITH: `${TEST_SECRET}_other` });
  check(wrong.status === 400 && String(wrong.body).startsWith("Webhook Error"), "signature from another secret → 400 (no fallback secret)");

  const good = run({ STRIPE_WEBHOOK_SECERET: TEST_SECRET, SIGN_WITH: TEST_SECRET });
  check(good.status === 200 && good.body && good.body.received === true, "signature with the configured env secret → verified");
  check(good.configuredLog === "Stripe webhook configured: yes", "startup log says configured: yes");
  check(!missing.leaked && !wrong.leaked && !good.leaked, "secret value never logged");

  console.log(failures ? `[stripe-webhook-secret] ${failures} failed` : "[stripe-webhook-secret] passed");
  process.exit(failures ? 1 : 0);
}
