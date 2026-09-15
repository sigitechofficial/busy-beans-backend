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
    "partnerEmployee",
    "subAdmin"
  )
);

/**
 * @swagger
 * /api/v1/leads:
 *   get:
 *     summary: Get all leads
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of leads
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Create a new lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               company:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lead created
 *       401:
 *         description: Unauthorized
 */
router
  .route("/")
  .get(leadController.getAllLeads)
  .post(leadController.createLead);

/**
 * @swagger
 * /api/v1/leads/kanban:
 *   get:
 *     summary: Get leads in kanban format
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Kanban leads
 *       401:
 *         description: Unauthorized
 */
router.get("/kanban", leadController.getKanbanLeads);

/**
 * @swagger
 * /api/v1/leads/stats:
 *   get:
 *     summary: Get lead statistics
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lead statistics
 *       401:
 *         description: Unauthorized
 */
router.get("/stats", leadController.getLeadStats);

/**
 * @swagger
 * /api/v1/leads/{id}:
 *   get:
 *     summary: Get lead by ID
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead details
 *       401:
 *         description: Unauthorized
 *   patch:
 *     summary: Update lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Lead updated
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Delete lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead deleted
 *       401:
 *         description: Unauthorized
 */
router
  .route("/:id")
  .get(leadController.getLeadById)
  .patch(leadController.updateLead)
  .delete(leadController.deleteLead);

/**
 * @swagger
 * /api/v1/leads/{id}/follow-up:
 *   post:
 *     summary: Schedule follow-up for lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               followUpDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Follow-up scheduled
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/follow-up", leadController.scheduleFollowUp);

/**
 * @swagger
 * /api/v1/leads/{id}/quotation:
 *   post:
 *     summary: Send quotation to lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Quotation sent
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/quotation", leadController.sendQuotation);

/**
 * @swagger
 * /api/v1/leads/{id}/site-visit:
 *   post:
 *     summary: Schedule site visit for lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               visitDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Site visit scheduled
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/site-visit", leadController.scheduleSiteVisit);

/**
 * @swagger
 * /api/v1/leads/{id}/won:
 *   patch:
 *     summary: Mark lead as won
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead marked as won
 *       401:
 *         description: Unauthorized
 */
router.patch("/:id/won", leadController.markAsWon);

/**
 * @swagger
 * /api/v1/leads/{id}/lost:
 *   patch:
 *     summary: Mark lead as lost
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead marked as lost
 *       401:
 *         description: Unauthorized
 */
router.patch("/:id/lost", leadController.markAsLost);

/**
 * @swagger
 * /api/v1/leads/{id}/assign:
 *   post:
 *     summary: Assign lead to user
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Lead assigned
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/assign", leadController.assignLead);

/**
 * @swagger
 * /api/v1/leads/{id}/logs:
 *   get:
 *     summary: Get lead activity logs
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead logs
 *       401:
 *         description: Unauthorized
 */
router.get("/:id/logs", leadController.getLeadLogs);

module.exports = router;
