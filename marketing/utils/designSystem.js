/**
 * Server-side mirror of the Campaign Builder's pageDesignSystemSchema
 * (page-builder-nextjs/src/design-system/page-design/pageDesignSystem.ts). Only named presets
 * are accepted — never raw CSS — so a stored block can't inject styles. Invalid input → null
 * (page renders with the default theme), unknown keys are dropped.
 */
const VERSIONS = ["busy-bean-v1", "busy-bean-v2"];
const THEMES = ["default", "private-label", "campaign", "editorial", "luxury"];
const TOKEN_KEYS = ["colorPreset", "typographyPreset", "radiusPreset", "spacingPreset", "buttonPreset", "cardPreset"];

function normalizeDesignSystem(value) {
  let input = value;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const version = input.version === undefined ? "busy-bean-v2" : input.version;
  const theme = input.theme === undefined ? "default" : input.theme;
  if (!VERSIONS.includes(version) || !THEMES.includes(theme)) return null;
  const out = { version, theme };
  if (input.tokens !== undefined) {
    if (!input.tokens || typeof input.tokens !== "object" || Array.isArray(input.tokens)) return null;
    const tokens = {};
    for (const key of TOKEN_KEYS) {
      const v = input.tokens[key];
      if (v === undefined) continue;
      if (typeof v !== "string" || v.length > 64) return null;
      tokens[key] = v;
    }
    out.tokens = tokens;
  }
  return out;
}

module.exports = { normalizeDesignSystem, DESIGN_SYSTEM_THEMES: THEMES };
