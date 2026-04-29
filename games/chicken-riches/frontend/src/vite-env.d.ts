/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOWED_HOSTS?: string;
  readonly VITE_NODE_ADDRESS?: string;
  readonly VITE_PROGRAM_ID?: string;
  readonly VITE_VOUCHER_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
