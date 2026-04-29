const boolFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
};

export const runtimeProfile = {
  profile: import.meta.env.VITE_ALPHABET_PROFILE ?? 'preview',
  apiBaseUrl: import.meta.env.VITE_ALPHABET_API_BASE_URL ?? 'http://localhost:3000',
  enableTelemetry: boolFromEnv(import.meta.env.VITE_ALPHABET_ENABLE_TELEMETRY, false),
  featureToggles: {
    experimentalChips: boolFromEnv(import.meta.env.VITE_ALPHABET_ENABLE_EXPERIMENTAL_CHIPS, false),
    protocolPlayground: boolFromEnv(import.meta.env.VITE_ALPHABET_ENABLE_PROTOCOL_PLAYGROUND, true),
  },
  fallback: {
    mockMode: boolFromEnv(import.meta.env.VITE_ALPHABET_ENABLE_MOCK_FALLBACK, true),
    gracefulDegrade: boolFromEnv(import.meta.env.VITE_ALPHABET_ENABLE_GRACEFUL_DEGRADE, true),
  },
} as const;
