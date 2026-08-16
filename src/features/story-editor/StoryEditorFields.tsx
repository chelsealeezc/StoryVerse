import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, MapPin } from "lucide-react";
import { uiCopy as copy } from "../../data/interface-content";
import { guides } from "../../data/story-content";
import { formatCoords, geocodePlace, searchPlaces } from "../../services/place-search";
import type { PlaceSuggestion } from "../../services/place-search";
import type { StoryDraft, Language } from "../../types/domain";

const guideById = (id: string) => guides.find((guide) => guide.id === id) ?? null;

function localizedGuideText(guide: (typeof guides)[number], language: Language) {
  const prompt = language === "zh" ? guide.prompt : guide.enPrompt;
  const examples = language === "zh" ? guide.examples : guide.enExamples;
  return { prompt, examples };
}

export function getActiveGuide(draft: StoryDraft, language: Language) {
  const guide = guideById(draft.guide);
  if (!guide) return null;
  const localized = localizedGuideText(guide, language);
  if (guide.id !== "other") return { ...guide, ...localized };
  const custom = draft.customGuide.trim();
  return custom
    ? {
        ...guide,
        ...localized,
        prompt: custom,
        examples:
          language === "zh"
            ? "这是你自己写下的入口，怎么讲都可以。"
            : "This is your own entry point. Tell it in any way you like.",
      }
    : { ...guide, ...localized };
}

export function GuideStack({
  draft,
  updateDraft,
  language,
}: {
  draft: StoryDraft;
  updateDraft: (patch: Partial<StoryDraft>) => void;
  language: Language;
}) {
  const previousIndex = useRef(
    Math.max(
      0,
      guides.findIndex((guide) => guide.id === draft.guide),
    ),
  );
  const currentIndex = Math.max(
    0,
    guides.findIndex((guide) => guide.id === draft.guide),
  );

  useEffect(() => {
    previousIndex.current = currentIndex;
  }, [currentIndex]);

  return (
    <div className="guide-panels" style={{ "--active": currentIndex } as CSSProperties} aria-label="人生事件引导选择">
      {guides.map((guide, i) => {
        const selected = draft.guide === guide.id;
        const fromLeft = currentIndex >= previousIndex.current;
        const { prompt, examples } = localizedGuideText(guide, language);
        const title = language === "zh" ? guide.title : guide.en;
        const foldedTitle = language === "zh" ? (guide.shortTitle ?? guide.title) : (guide.enShort ?? guide.en);
        return (
          <div
            role="button"
            tabIndex={0}
            key={guide.id}
            className={`guide-panel ${selected ? "selected" : ""} ${fromLeft ? "from-left" : "from-right"}`}
            onClick={() => updateDraft({ guide: guide.id })}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                updateDraft({ guide: guide.id });
              }
            }}
            aria-expanded={selected}
          >
            <div className="guide-content">
              <div className="guide-main">
                <div className="guide-top">
                  <span className="guide-icon">{guide.icon}</span>
                  <div className="guide-title-lockup">
                    <h2>{title}</h2>
                    {language === "zh" && <em>{guide.en}</em>}
                  </div>
                  <small>
                    0{i + 1} / 0{guides.length}
                  </small>
                </div>
                <p>{prompt}</p>
              </div>
              <div className="guide-side">
                {guide.id === "other" ? (
                  <label className="guide-custom">
                    {language === "zh" ? "你想讲的是哪一种时刻？" : "What kind of moment do you want to tell?"}
                    <input
                      value={draft.customGuide}
                      maxLength={40}
                      placeholder={
                        language === "zh" ? "例如：一次没有人知道的坚持" : "Example: a quiet persistence nobody saw"
                      }
                      onClick={(event) => event.stopPropagation()}
                      onFocus={() => updateDraft({ guide: "other" })}
                      onChange={(event) => updateDraft({ customGuide: event.target.value, guide: "other" })}
                    />
                  </label>
                ) : (
                  <footer>
                    <span>{language === "zh" ? "比如" : "Example"}</span>
                    {examples}
                  </footer>
                )}
                <span className="guide-pick">
                  {selected ? (
                    <>
                      <Check size={16} /> {language === "zh" ? "已选择" : "Selected"}
                    </>
                  ) : language === "zh" ? (
                    "选择这个入口"
                  ) : (
                    "Choose this entry"
                  )}
                </span>
              </div>
            </div>
            <div className="small-title" aria-hidden="true">
              <span>{guide.icon}</span>
              <p>{foldedTitle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CityField({
  draft,
  updateDraft,
  label,
  language,
}: {
  draft: StoryDraft;
  updateDraft: (patch: Partial<StoryDraft>) => void;
  label: string;
  language: Language;
}) {
  const text = copy[language];
  const [query, setQuery] = useState(draft.city);
  const [options, setOptions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const committed = useRef(draft.city);

  useEffect(() => {
    setQuery(draft.city);
  }, [draft.city]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchPlaces(query).then((result) => {
        if (!alive) return;
        setOptions(result);
        setActive(0);
        setLoading(false);
      });
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const pick = (place: PlaceSuggestion) => {
    updateDraft({
      city: place.name,
      cityNameEn: place.nameEn,
      cityCountry: place.country,
      cityLat: place.lat,
      cityLon: place.lon,
    });
    setQuery(place.name);
    setOpen(false);
  };
  const commitText = (text: string) => {
    const value = text.trim();
    if (value === draft.city) return;
    updateDraft({ city: value, cityNameEn: "", cityCountry: "", cityLat: null, cityLon: null });
    committed.current = value;
    if (!value) return;
    geocodePlace(value).then((point) => {
      if (point && committed.current === value) updateDraft({ cityLat: point.lat, cityLon: point.lon });
    });
  };
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (!open || options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((active + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((active - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(options[active] ?? options[0]);
    } else if (event.key === "Escape") setOpen(false);
  };

  return (
    <label>
      <span className="field-name">
        {label} <small>{text.cityHint}</small>
      </span>
      <div className="city-field">
        <input
          value={query}
          placeholder={text.cityPlaceholder}
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
            commitText(query);
          }}
        />
        <MapPin size={16} className="field-icon" />
        {open && (options.length > 0 || loading) && (
          <div className="city-options">
            {options.map((place, i) => (
              <button
                key={place.id}
                className={i === active ? "active" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(place)}
              >
                <b>{place.name}</b>
                <span>{place.detail}</span>
              </button>
            ))}
            {loading && <p className="city-loading">{text.citySearching}</p>}
          </div>
        )}
      </div>
      <span className="city-coords">
        {!draft.city ? (
          ""
        ) : draft.cityLat !== null ? (
          <>
            {text.coordsResolved} {formatCoords(draft.cityLat, draft.cityLon)} · {text.coordsUse}
          </>
        ) : (
          <>{text.coordsMissing}</>
        )}
      </span>
    </label>
  );
}

/**
 * 性别选择。第二步和第四步共用同一个组件，选项文案跟随语言，
 * 但存进 draft 的值固定是中文（男 / 女 / 其他），这样切换语言不会把已选的值弄丢，
 * 给本地故事配图逻辑的取值也保持稳定。
 */
const genderOptions = [
  { value: "男", label: "genderMale" },
  { value: "女", label: "genderFemale" },
  { value: "其他", label: "genderOther" },
] as const;

export function AgeField({
  draft,
  updateDraft,
  text,
}: {
  draft: StoryDraft;
  updateDraft: (patch: Partial<StoryDraft>) => void;
  text: (typeof copy)["zh"] | (typeof copy)["en"];
}) {
  return (
    <label>
      <span className="field-name">{text.ageLabel}</span>
      <div className="age-field">
        <input
          required
          inputMode="numeric"
          value={draft.age}
          placeholder="26"
          onChange={(event) => updateDraft({ age: event.target.value.replace(/\D/g, "").slice(0, 3) })}
        />
        <span>{text.ageUnit}</span>
      </div>
    </label>
  );
}

export function GenderField({
  draft,
  updateDraft,
  text,
}: {
  draft: StoryDraft;
  updateDraft: (patch: Partial<StoryDraft>) => void;
  text: (typeof copy)["zh"] | (typeof copy)["en"];
}) {
  return (
    <label>
      <span className="field-name">{text.gender}</span>
      <select required value={draft.gender} onChange={(event) => updateDraft({ gender: event.target.value })}>
        <option value="">{text.genderPick}</option>
        {genderOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {text[option.label]}
          </option>
        ))}
      </select>
    </label>
  );
}
