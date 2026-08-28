function parseJsonField(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function jsonGetter(attribute, fallback) {
  return function getJsonField() {
    return parseJsonField(this.getDataValue(attribute), fallback);
  };
}

function jsonSetter(attribute) {
  return function setJsonField(value) {
    this.setDataValue(attribute, value);
  };
}

module.exports = {
  parseJsonField,
  jsonGetter,
  jsonSetter,
};
