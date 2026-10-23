// Scheduling never sanitizes SVG. Keep LogoSanitizerService and its Nest
// wiring real, but fail if this unrelated dependency is used by the E2E gate.
let sanitizeCallCount = 0;

export function getSanitizeCallCount() {
  return sanitizeCallCount;
}

export function resetSanitizeCallCount() {
  sanitizeCallCount = 0;
}

export default {
  sanitize(_input: string): never {
    sanitizeCallCount += 1;
    throw new Error(
      'SVG sanitization is outside the email scheduling E2E gate',
    );
  },
};
