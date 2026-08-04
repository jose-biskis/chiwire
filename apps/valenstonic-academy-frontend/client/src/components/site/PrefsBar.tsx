import { ArchetypeSelect, ThemeSelect } from "@chiwire/ui/base";
import { LANG_IDS } from "@/lib/site-prefs";
import { useSitePrefs } from "@/lib/useSitePrefs";

export function PrefsBar() {
  const {
    archetype,
    theme,
    lang,
    messages,
    switchArchetype,
    switchTheme,
    switchLang
  } = useSitePrefs();

  return (
    <div
      className="prefs-bar"
      role="region"
      aria-label={`${messages.archetypeLabel} / ${messages.themeLabel} / ${messages.langLabel}`}
    >
      <div className="prefs-group">
        <strong>{messages.archetypeLabel}</strong>
        <ArchetypeSelect
          variant="pills"
          value={archetype}
          getHref={switchArchetype}
          aria-label={messages.archetypeLabel}
        />
      </div>
      <div className="prefs-group">
        <strong>{messages.themeLabel}</strong>
        <ThemeSelect
          variant="pills"
          value={theme}
          options={["dark", "light"]}
          getHref={switchTheme}
          labels={{ dark: messages.themeDark, light: messages.themeLight }}
          aria-label={messages.themeLabel}
        />
      </div>
      <div className="prefs-group prefs-group-lang">
        <strong>{messages.langLabel}</strong>
        <div className="prefs-pills">
          {LANG_IDS.map((id) => (
            <a
              key={id}
              href={switchLang(id)}
              className="prefs-pill"
              aria-current={lang === id ? "true" : undefined}
            >
              {id === "en" ? "EN" : "ES"}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
