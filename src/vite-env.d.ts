/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_USERNAME: string;
  readonly VITE_DEFAULT_PASSWORD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
