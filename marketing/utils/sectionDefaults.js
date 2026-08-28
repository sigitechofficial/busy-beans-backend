function defaultContentForType(type) {
  const defaults = {
    hero: {
      headline: "Your headline here",
      subheadline: "",
      primaryCtaLabel: "Get Started",
      primaryCtaUrl: "#lead-form",
    },
    faq: { title: "Frequently Asked Questions", items: [] },
    "lead-form": {
      title: "Get in touch",
      fields: [
        { id: "name", label: "Name", type: "text", required: true },
        { id: "email", label: "Email", type: "email", required: true },
      ],
      thankYouMessage: "Thanks! We will get back to you soon.",
      testMode: false,
    },
    benefits: { title: "Why choose us", items: [] },
    "cta-banner": {
      headline: "Ready to get started?",
      ctaLabel: "Contact us",
      ctaUrl: "#lead-form",
    },
  };
  return defaults[type] || {};
}

module.exports = { defaultContentForType };
