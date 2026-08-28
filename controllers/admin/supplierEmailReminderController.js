const {
  resendUnopenedSupplierEmails,
} = require("../../services/supplierUnopenedResendService");

// Florida observes US Eastern Time (IANA zone: America/New_York).
const FLORIDA_TIMEZONE = "America/New_York";

function isWeekendInBusinessTimezone() {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: FLORIDA_TIMEZONE,
    weekday: "short",
  }).format(new Date());
  return weekday === "Sat" || weekday === "Sun";
}

exports.resendUnopenedSupplierEmails = async (req, res) => {
  try {
    if (isWeekendInBusinessTimezone()) {
      return res.status(200).json({
        status: "success",
        message: "Supplier unopened email resend skipped (weekend)",
        data: {
          scanned: 0,
          eligibleChecked: 0,
          resentSuccess: 0,
          resentFailed: 0,
          skipped: { weekend: 1 },
        },
      });
    }

    const minHours = Number(req.body?.minHours || req.query?.minHours || 24);
    const maxRetry = Number(req.body?.maxRetry || req.query?.maxRetry || 3);

    const summary = await resendUnopenedSupplierEmails({ minHours, maxRetry });

    return res.status(200).json({
      status: "success",
      message: "Supplier unopened email resend job completed",
      data: summary,
    });
  } catch (err) {
    console.error("[supplierResendController] Job failed:", err.message);
    return res.status(500).json({
      status: "fail",
      message: "Supplier unopened email resend job failed",
      error: err.message,
    });
  }
};
