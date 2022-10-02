import validator from "validator";

/**
 * Check if valid URL
 * @param {string} urlString
 */
export function isValidURL(urlString: string) {
  return validator.isURL(urlString, {
    protocols: ["http", "https"],
    require_protocol: true,
    allow_underscores: true,
  });
}
