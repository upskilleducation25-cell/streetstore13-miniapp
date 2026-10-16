/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базова адреса API без /api/v1, наприклад https://api.streetstore13.com.ua */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
