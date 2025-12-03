const express = require("express");
const leadController = require("../controllers/admin/leadController");
const authController = require("../controllers/admin/authController");
const auth = require("../middlewares/protect");

const router = express.Router();

// Protect all routes
router.use(auth.protect);
// Restrict to admin and sales-rep (adjust roles as needed)
router.use(auth.restrictTo("admin", "salesRep", "localPartner"));

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

module.exports = router;
