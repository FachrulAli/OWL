/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OWL_API?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.png' {
  const src: string
  export default src
}
