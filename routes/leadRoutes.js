const express = require("express");
const leadController = require("../controllers/admin/leadController");
const authController = require("../controllers/admin/authController");
const auth = require("../middlewares/protect");

const router = express.Router();

// Protect all routes
router.use(auth.protect);
// Restrict to admin, sales-rep, and employees
router.use(
  auth.restrictTo(
    "admin",
    "salesRep",
    "localPartner",
    "adminEmployee",
    "partnerEmployee"
  )
);

router
  .route("/")
  .get(leadController.getAllLeads)
  .post(leadController.createLead);

router.get("/kanban", leadController.getKanbanLeads);
router.get("/stats", leadController.getLeadStats);

router
  .route("/:id")
  .get(leadController.getLeadById)
  .patch(leadController.updateLead)
  .delete(leadController.deleteLead);

router.post("/:id/follow-up", leadController.scheduleFollowUp);
router.post("/:id/quotation", leadController.sendQuotation);
router.post("/:id/site-visit", leadController.scheduleSiteVisit);

router.patch("/:id/won", leadController.markAsWon);
router.patch("/:id/lost", leadController.markAsLost);

// New endpoints
router.post("/:id/assign", leadController.assignLead);
router.get("/:id/logs", leadController.getLeadLogs);

module.exports = router;
