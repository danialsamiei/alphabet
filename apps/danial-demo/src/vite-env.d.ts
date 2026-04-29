/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALPHABET_PROFILE?: 'preview' | 'staging' | 'production';
  readonly VITE_ALPHABET_API_BASE_URL?: string;
  readonly VITE_ALPHABET_ENABLE_TELEMETRY?: 'true' | 'false';
  readonly VITE_ALPHABET_ENABLE_EXPERIMENTAL_CHIPS?: 'true' | 'false';
  readonly VITE_ALPHABET_ENABLE_PROTOCOL_PLAYGROUND?: 'true' | 'false';
  readonly VITE_ALPHABET_ENABLE_MOCK_FALLBACK?: 'true' | 'false';
  readonly VITE_ALPHABET_ENABLE_GRACEFUL_DEGRADE?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
