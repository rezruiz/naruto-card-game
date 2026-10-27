/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'prototype' for the prototype build (set by the deploy workflow); unset for the base game. */
  readonly VITE_VARIANT?: string;
}
