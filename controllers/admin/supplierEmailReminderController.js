const {
  resendUnopenedSupplierEmails,
} = require("../../services/supplierUnopenedResendService");

exports.resendUnopenedSupplierEmails = async (req, res) => {
  try {
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
