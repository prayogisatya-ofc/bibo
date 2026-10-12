import { createContext, useContext } from "react";
import { id } from "./locales/id.js";
import { en } from "./locales/en.js";

export type Locale = "id" | "en";
export type Strings = Record<keyof typeof id, string>;

const STRINGS: Record<Locale, Strings> = { id, en };

export function getStrings(locale: Locale): Strings {
  return STRINGS[locale] ?? STRINGS.id;
}

/** Isi placeholder `{name}` / `{mode}` pada string i18n (nama karakter tidak di-hardcode). */
export function fill(tmpl: string, vars: Record<string, string>): string {
  let out = tmpl;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

/** Semua kunci id dan en harus sama (NFR-I18N-01). */
const idKeys = Object.keys(id).sort();
const enKeys = Object.keys(en).sort();
if (JSON.stringify(idKeys) !== JSON.stringify(enKeys)) {
  throw new Error(`i18n key mismatch: id[${idKeys.length}] vs en[${enKeys.length}]`);
}

const LocaleCtx = createContext<Locale>("id");

export const LocaleProvider = LocaleCtx.Provider;

export function useLocale(): Locale {
  return useContext(LocaleCtx);
}

export function useT(): Strings {
  return getStrings(useContext(LocaleCtx));
}
