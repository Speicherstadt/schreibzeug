import { m } from "../paraglide/messages";
import { getLocale, type Locale, locales, setLocale } from "../paraglide/runtime";
import { Select } from "../ui/select";

const languageName = (locale: Locale): string =>
  locale === "de" ? m.settings_language_german() : m.settings_language_english();

/** The language of the interface, remembered in this browser; changing it loads the page anew. */
export const LanguageSection = () => (
  <section aria-label={m.settings_language_title()} className="flex flex-col gap-3">
    <div className="flex flex-col gap-1">
      <h2 className="m-0 text-base font-semibold">{m.settings_language_title()}</h2>
      <p className="m-0 text-sm text-[var(--muted-foreground)]">{m.settings_language_hint()}</p>
    </div>
    <Select
      aria-label={m.settings_language_title()}
      value={getLocale()}
      onChange={(event) => setLocale(event.target.value as Locale)}
      className="self-start"
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {languageName(locale)}
        </option>
      ))}
    </Select>
  </section>
);
