interface ImportMetaEnv {
  /** Where the build serves the engine: /engine/<id of the prepared engine> (engine-plugin.ts). */
  readonly ENGINE_PATH: string;
  /** The version of Schreibzeug, from the root package.json (vite.config.ts). */
  readonly APP_VERSION: string;
}
