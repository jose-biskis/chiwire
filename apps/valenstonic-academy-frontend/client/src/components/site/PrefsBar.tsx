import { LANG_IDS, STYLE_IDS, STYLE_META } from "@/lib/site-prefs";
import { useSitePrefs } from "@/lib/useSitePrefs";

export function PrefsBar() {
  const { style, lang, messages, switchStyle, switchLang } = useSitePrefs();

  return (
    <div className="prefs-bar" role="region" aria-label={`${messages.styleLabel} / ${messages.langLabel}`}>
      <div className="prefs-group">
        <strong>{messages.styleLabel}</strong>
        <div className="prefs-pills">
          {STYLE_IDS.map((id) => (
            <a
              key={id}
              href={switchStyle(id)}
              className="prefs-pill"
              aria-current={style === id ? "true" : undefined}
            >
              {lang === "es" ? STYLE_META[id].labelEs : STYLE_META[id].labelEn}
            </a>
          ))}
        </div>
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
