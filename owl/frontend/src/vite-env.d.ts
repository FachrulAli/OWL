/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OWL_API?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
