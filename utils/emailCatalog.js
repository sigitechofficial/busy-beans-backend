const TYPE_DEFAULT_RECIPIENT_ID = 0;

const AUTH_EMAILS = [
  { key: "otp_verification", label: "Account / login OTP", locked: true },
  {
    key: "otp_forgot_password",
    label: "Forgot-password OTP",
    locked: true,
  },
];

const HQ_AUTH_EMAILS = [
  ...AUTH_EMAILS,
  { key: "otp_hq_verification", label: "HQ signup OTP", locked: true },
];

const EMAILS_BY_TYPE = {
  customer: [
    ...AUTH_EMAILS,
    { key: "order_confirmation", label: "Order confirmation", locked: false },
    { key: "order_dispatch", label: "Order dispatch", locked: false },
    { key: "order_shipped", label: "Order shipped", locked: false },
    { key: "invoice_sent", label: "Invoice sent", locked: false },
    { key: "invoice_reminder", label: "Payment reminder", locked: false },
    { key: "paid_receipt", label: "Paid receipt", locked: false },
    {
      key: "subscription_invitation",
      label: "Subscription invitation",
      locked: false,
    },
    {
      key: "subscription_cancellation",
      label: "Subscription cancelled",
      locked: false,
    },
    { key: "quotation", label: "Quotation", locked: false },
    { key: "account_approved", label: "Account approved", locked: false },
  ],
  partner: [
    ...AUTH_EMAILS,
    { key: "partner_new_order", label: "Partner new order", locked: false },
    {
      key: "paid_receipt_admin",
      label: "Paid receipt (partner)",
      locked: false,
    },
    { key: "payment_pullout", label: "Payment pullout", locked: false },
    { key: "daily_eod_report", label: "Daily EOD report", locked: false },
    { key: "connect_stripe", label: "Connect Stripe", locked: false },
    {
      key: "customer_registration_notify",
      label: "New customer notify",
      locked: false,
    },
  ],
  supplier: [
    ...AUTH_EMAILS,
    { key: "supplier_new_order", label: "Supplier new order", locked: false },
  ],
  employee: [...AUTH_EMAILS],
  subAdmin: [...AUTH_EMAILS],
  hq: [
    ...HQ_AUTH_EMAILS,
    { key: "daily_eod_report_admin", label: "HQ daily EOD", locked: false },
    {
      key: "customer_registration_notify",
      label: "New customer notify (HQ)",
      locked: false,
    },
    { key: "get_in_touch", label: "Get in touch", locked: false },
    {
      key: "coffee_machine_admin",
      label: "Coffee machine lead (HQ)",
      locked: false,
    },
    { key: "landing_page_lead", label: "Landing page lead", locked: false },
    {
      key: "welcome_internal",
      label: "Account created (internal)",
      locked: false,
    },
    {
      key: "partner_new_order",
      label: "Partner new order (HQ fallback)",
      locked: false,
    },
    {
      key: "paid_receipt_admin",
      label: "Paid receipt (HQ fallback)",
      locked: false,
    },
  ],
  lead: [
    {
      key: "coffee_machine_customer",
      label: "Coffee machine request",
      locked: false,
    },
    { key: "lead_quotation", label: "Lead quotation", locked: false },
  ],
};

const RECIPIENT_TYPES = Object.keys(EMAILS_BY_TYPE);

const TABS = [
  { type: "customer", label: "Customers", hasPeople: true },
  { type: "partner", label: "Local Partners", hasPeople: true },
  { type: "supplier", label: "Suppliers", hasPeople: true },
  { type: "employee", label: "Employees", hasPeople: true },
  { type: "subAdmin", label: "Sub Admins", hasPeople: true },
  { type: "hq", label: "HQ Admin", hasPeople: false },
  { type: "lead", label: "Leads", hasPeople: false },
];

const LOCKED_EMAIL_KEYS = new Set([
  "otp_verification",
  "otp_forgot_password",
  "otp_hq_verification",
]);

function getEmailsForType(recipientType) {
  return EMAILS_BY_TYPE[recipientType] || [];
}

function isLockedEmailType(emailType) {
  return LOCKED_EMAIL_KEYS.has(emailType);
}

function isKnownEmailType(recipientType, emailType) {
  return getEmailsForType(recipientType).some((item) => item.key === emailType);
}

function getCatalog() {
  return {
    tabs: TABS.map((tab) => ({
      ...tab,
      emails: getEmailsForType(tab.type),
    })),
  };
}

module.exports = {
  TYPE_DEFAULT_RECIPIENT_ID,
  RECIPIENT_TYPES,
  EMAILS_BY_TYPE,
  TABS,
  getEmailsForType,
  isLockedEmailType,
  isKnownEmailType,
  getCatalog,
};
