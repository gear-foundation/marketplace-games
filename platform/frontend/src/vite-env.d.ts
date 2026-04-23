/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NODE_ADDRESS?: string;
  readonly VITE_SKYBOUND_JUMP_URL?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_ALLOWED_HOSTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
