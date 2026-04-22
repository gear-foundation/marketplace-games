/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NODE_ADDRESS?: string;
  readonly VITE_PROGRAM_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
