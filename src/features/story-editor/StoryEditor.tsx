import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Download, Eye, LoaderCircle, MapPin, Mic, RefreshCw, Sparkles, X } from "lucide-react";
import { LanguageSelect, AppLogo, Pill, PrimaryButton, ThemeToggle } from "../../components/AppControls";
import { uiCopy as copy } from "../../data/interface-content";
import { guides } from "../../data/story-content";
import { extractHints } from "../../lib/story-hints";
import { dataService } from "../../services/data-service";
import { downloadStoryImage, createStoryImagePreview } from "../../services/story-image";
import type { ImageStyle, StoryHighlight } from "../../services/story-image";
import { formatCoords } from "../../services/place-search";
import { startSpeechRecognition, SpeechRecognitionError } from "../../services/speech-input";
import type { SpeechRecognitionHandle } from "../../services/speech-input";
import { Tour } from "../tour/Tour";
import type { TourCallbacks } from "../tour/tour-types";
import { getActiveGuide, AgeField, CityField, GenderField, GuideStack } from "./StoryEditorFields";
import {
  blankPrompts,
  createStoryTagSet,
  getFallbackEventType,
  getMissingRequiredStoryFields,
  eventTypeTags,
  imageStyleOptions,
  isStoryBodyLengthValid,
  moodOptions,
  peopleOptions,
  STORY_BODY_MAX_LENGTH,
  STORY_BODY_MIN_LENGTH,
  stageOptions,
  storyTagsToAnalysisTags,
  getThemeLabel,
} from "./story-editor-model";
import type { RequiredStoryField } from "./story-editor-model";
import type {
  AppState,
  StoryDraft,
  StoryEventTypeTag,
  StoryTagSet,
  StoryEditorStep,
  StoryThemeTag,
  TourSceneId,
} from "../../types/domain";
import type { AppUpdate, ThemeMode } from "../../types/ui";

export function StoryEditor({
  state,
  update,
  onPublished,
  onHome,
  themeMode,
  onThemeModeChange,
  tourActive,
  onTourFinish,
  onTourSkip,
}: {
  state: AppState;
  update: AppUpdate;
  onPublished: (draft: StoryDraft, analysis: NonNullable<AppState["analysis"]>) => Promise<void>;
  onHome: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (themeMode: ThemeMode) => void;
} & TourCallbacks) {
  const step = state.storyEditorStep;
  const draft = state.draft;
  const language = state.language;
  const text = copy[language];
  /* 步骤 → 引导场景。第 2 步是 AI 整理的等待页，按需求不做引导。 */
  const sceneForStep: Partial<Record<StoryEditorStep, TourSceneId>> = { 0: "guide", 1: "collection", 3: "confirm" };
  const candidateScene = sceneForStep[step];
  // 第 4 步要等 analysis 出来、内容真正渲染了才有目标可高亮
  const storyEditorTourScene =
    candidateScene && tourActive(candidateScene) && (step !== 3 || !!state.analysis) ? candidateScene : null;
  const [analysisStage, setAnalysisStage] = useState(0);
  const [analysisRequestVersion, setAnalysisRequestVersion] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [idlePromptIndex, setIdlePromptIndex] = useState(0);
  const [resting, setResting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "editing" | "saved">(draft.savedAt ? "saved" : "idle");
  const [pasteDialog, setPasteDialog] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<StoryEditorStep | null>(null);
  const [editingBody, setEditingBody] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [tagDrafts, setTagDrafts] = useState<Record<string, string[]>>({});
  const [storyTags, setStoryTags] = useState<StoryTagSet | null>(null);
  const [tagEditing, setTagEditing] = useState<"emotions" | "eventType" | "themes" | null>(null);
  /* 语音输入：listening 表示浏览器正在识别，processing 表示正在收取最终文字。 */
  const [speechState, setSpeechState] = useState<"idle" | "listening" | "processing">("idle");
  const [speechError, setSpeechError] = useState("");
  const speechRecognitionRef = useRef<SpeechRecognitionHandle | null>(null);
  const [customTheme, setCustomTheme] = useState("");
  const [themeTagError, setThemeTagError] = useState("");
  const [removedThemeTags, setRemovedThemeTags] = useState<StoryThemeTag[]>([]);
  const [imageStyle, setImageStyle] = useState<ImageStyle>("clay-3d");
  const [storyImage, setStoryImage] = useState("");
  const [storyHighlight, setStoryHighlight] = useState<StoryHighlight | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageStatus, setImageStatus] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [imageError, setImageError] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [enabledTypeIds, setEnabledTypeIds] = useState<Set<string> | null>(null);
  const hints = useMemo(() => extractHints(draft.body), [draft.body]);
  const storyBodyLength = draft.body.trim().length;
  const storyBodyLengthValid = isStoryBodyLengthValid(draft.body);
  const mounted = useRef(false);

  useEffect(() => {
    dataService
      .listStoryTypes()
      .then((types) => setEnabledTypeIds(new Set(types.map((type) => type.id))))
      .catch(() => setEnabledTypeIds(null));
  }, []);

  const updateDraft = (patch: Partial<StoryDraft>) =>
    update((previous) => ({ draft: { ...previous.draft, ...patch } }));
  const runImageGeneration = async () => {
    if (!state.analysis) return;
    setImageStatus("generating");
    setImageError("");
    try {
      const result = await createStoryImagePreview(draft, state.analysis, imageStyle, Object.values(tagDrafts).flat());
      setStoryImage(result.imageUrl);
      setStoryHighlight(result.highlight);
      setImagePrompt(result.imagePrompt);
      setImageStatus("ready");
    } catch (error) {
      setImageStatus("failed");
      setImageError(
        error instanceof Error
          ? error.message
          : language === "zh"
            ? "图片生成失败，请稍后重试。"
            : "Image generation failed. Please try again.",
      );
    }
  };
  const selectImageStyle = (nextStyle: ImageStyle) => {
    if (nextStyle === imageStyle) return;
    setImageStyle(nextStyle);
    setStoryImage("");
    setStoryHighlight(null);
    setImagePrompt("");
    setImageStatus("idle");
    setImageError("");
  };
  useEffect(() => {
    const timer = window.setInterval(() => {
      update((previous) => ({ draft: { ...previous.draft, saves: previous.draft.saves + 1, savedAt: Date.now() } }));
    }, 20000);
    return () => clearInterval(timer);
  }, [update]);
  const contentKey = [
    draft.title,
    draft.body,
    draft.mood,
    draft.stage,
    draft.age,
    draft.gender,
    draft.city,
    draft.cityNameEn,
    draft.cityCountry,
    draft.cityLat,
    draft.cityLon,
    draft.people.join(","),
  ].join("\u0000");
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!draft.title && !draft.body) return;
    setSaveStatus("editing");
    const timer = window.setTimeout(() => {
      updateDraft({ savedAt: Date.now(), saves: draft.saves + 1 });
      setSaveStatus("saved");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [contentKey]);
  useEffect(() => {
    if (step !== 1) return;
    const timer = window.setInterval(
      () => setIdlePromptIndex((index) => (index + 1) % blankPrompts[language].length),
      5000,
    );
    return () => clearInterval(timer);
  }, [step]);
  useEffect(() => {
    if (step !== 1 || !draft.body.trim()) {
      setResting(false);
      return;
    }
    const timer = window.setTimeout(() => setResting(true), 18000);
    return () => clearTimeout(timer);
  }, [step, draft.body, draft.edits]);
  useEffect(() => {
    if (step !== 1 || !draft.body.trim()) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step, draft.body]);
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);
  useEffect(() => {
    if (!focusMode || step !== 1) return;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [focusMode, step]);
  useEffect(() => {
    if (step !== 2) return;
    setAnalysisStage(0);
    const timers = [650, 1400, 2200].map((time, i) => window.setTimeout(() => setAnalysisStage(i + 1), time));
    let cancelled = false;
    setAnalysisError("");
    dataService
      .analyzeDraft(draft, state.analysis?.id)
      .then((analysis) => {
        if (!cancelled) update({ analysis });
      })
      .catch((error) => {
        if (!cancelled) setAnalysisError(error instanceof Error ? error.message : "故事整理暂时没有完成，请重试。");
      });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [step, analysisRequestVersion]);
  useEffect(() => {
    if (!state.analysis) return;
    setTagDrafts(
      Object.fromEntries(Object.entries(state.analysis.tags).map(([layer, tags]) => [layer, tags.slice(0, 3)])),
    );
    setStoryTags(state.analysis.storyTags ?? createStoryTagSet(draft, state.analysis));
    setTagEditing(null);
    setCustomTheme("");
    setThemeTagError("");
    setRemovedThemeTags([]);
  }, [state.analysis]);

  const choosePerson = (person: string) => {
    const people = draft.people.includes(person) ? draft.people.filter((p) => p !== person) : [...draft.people, person];
    updateDraft({ people });
  };
  const guide = getActiveGuide(draft, language);
  const guidePrompt = guide?.prompt;
  const hasUnfinishedStory = draft.body.trim().length > 0 && step === 1;
  const requestStep = (nextStep: StoryEditorStep) => {
    if (hasUnfinishedStory && nextStep < step) setLeaveTarget(nextStep);
    else update({ storyEditorStep: nextStep });
  };
  const saveCurrentDraft = () => {
    if (!draft.body.trim() && !draft.title.trim() && !draft.customGuide.trim()) return;
    update((previous) => ({
      draft: { ...previous.draft, saves: previous.draft.saves + 1, savedAt: Date.now() },
    }));
  };
  const confirmLeave = (save: boolean) => {
    if (save) saveCurrentDraft();
    if (leaveTarget !== null) update({ storyEditorStep: leaveTarget });
    setLeaveTarget(null);
  };
  // 外面那句「还差一点：…」已经是双语的，这几项当时漏了，切英文也还是中文
  /*
   * 缺项直接引用表单上那一栏的标题（text.yourStory / text.mood / …），
   * 用户扫一眼就知道该往哪儿看；自己另写一套说法反而对不上。
   */
  const requiredStoryFieldLabels: Record<RequiredStoryField, string> = {
    body:
      language === "zh"
        ? `${text.yourStory}（${STORY_BODY_MIN_LENGTH}–${STORY_BODY_MAX_LENGTH} 字）`
        : `${text.yourStory} (${STORY_BODY_MIN_LENGTH}–${STORY_BODY_MAX_LENGTH} characters)`,
    mood: text.mood,
    stage: text.lifeStage,
    city: text.city,
    age: text.ageLabel,
    gender: text.gender,
    people: text.people,
  };
  const missingCollection = getMissingRequiredStoryFields(draft).map(
    (field) => `${language === "zh" ? "「" : '"'}${requiredStoryFieldLabels[field]}${language === "zh" ? "」" : '"'}`,
  );
  const canContinueCollection = missingCollection.length === 0;
  const canContinueGuide = !!draft.guide && (draft.guide !== "other" || draft.customGuide.trim().length >= 2);
  const savedTime = draft.savedAt
    ? new Date(draft.savedAt).toLocaleTimeString(language === "zh" ? "zh-CN" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  /** 将用户确认后的标签交给服务端，并统一处理保存错误。 */
  const runPublish = () => {
    setPublishing(true);
    setPublishError("");
    const nextStoryTags = storyTags ?? createStoryTagSet(draft, state.analysis);
    const analysisTagUpdates = storyTagsToAnalysisTags(nextStoryTags);
    return onPublished(draft, {
      ...state.analysis!,
      tags: { ...state.analysis!.tags, ...tagDrafts, ...analysisTagUpdates },
      storyTags: nextStoryTags,
    })
      .catch((error) => {
        setPublishError(
          error instanceof Error
            ? error.message
            : language === "zh"
              ? "发布失败，请稍后重试。"
              : "Publishing failed. Please try again.",
        );
      })
      .finally(() => setPublishing(false));
  };

  const attemptPublish = () => {
    if (!storyBodyLengthValid) {
      setPublishError(
        language === "zh"
          ? `故事正文需要在 ${STORY_BODY_MIN_LENGTH}–${STORY_BODY_MAX_LENGTH} 字之间。`
          : `The story must be ${STORY_BODY_MIN_LENGTH}–${STORY_BODY_MAX_LENGTH} characters long.`,
      );
      return;
    }
    const confirmedThemes = (storyTags ?? createStoryTagSet(draft, state.analysis)).themes
      .map((theme) => theme.value.trim())
      .filter(Boolean);
    if (new Set(confirmedThemes).size !== 2) {
      setPublishError(
        language === "zh" ? "请确认两个不重复的故事主题。" : "Please confirm two different story themes.",
      );
      return;
    }
    void runPublish();
  };
  const showCityHint = !!hints.city && hints.city.name !== draft.city;
  const showAgeHint = hints.age !== null && String(hints.age) !== draft.age;
  /*
   * 识别出来的文字接在正文末尾，不覆盖已经写好的内容 ——
   * 用户通常是写了一段再补一段口述。
   */
  const toggleSpeechInput = async () => {
    setSpeechError("");
    if (speechState === "listening") {
      const handle = speechRecognitionRef.current;
      speechRecognitionRef.current = null;
      setSpeechState("processing");
      try {
        const text = handle ? await handle.stop() : "";
        if (text) {
          updateDraft({
            body: draft.body
              ? `${draft.body.replace(/\s+$/, "")}
${text}`
              : text,
            edits: draft.edits + 1,
          });
        }
      } catch (error) {
        setSpeechError(
          error instanceof SpeechRecognitionError
            ? error.message
            : language === "zh"
              ? "语音转文字失败了，可以重试，也可以直接打字。"
              : "Speech-to-text failed. Try again, or just type.",
        );
      } finally {
        setSpeechState("idle");
      }
      return;
    }
    try {
      speechRecognitionRef.current = await startSpeechRecognition(language);
      setSpeechState("listening");
    } catch (error) {
      setSpeechError(
        error instanceof SpeechRecognitionError
          ? error.message
          : language === "zh"
            ? "无法开始录音。"
            : "Could not start recording.",
      );
      setSpeechState("idle");
    }
  };
  // 离开这一步时把麦克风放掉，否则标签页的录音指示灯会一直亮
  useEffect(() => () => speechRecognitionRef.current?.cancel(), []);

  const activeStoryTags = storyTags ?? createStoryTagSet(draft, state.analysis);

  /*
   * 进第四步时把 AI 建议的标题真正写进 draft。
   * 之前输入框的 value 是 `draft.title || suggestedTitle`，draft.title 是空的时候
   * 显示的其实是建议标题 —— 一旦用户把它删空，value 立刻弹回建议标题，
   * 看上去就是「这个标题改不了」。
   */
  useEffect(() => {
    if (step === 3 && state.analysis && !draft.title.trim()) {
      updateDraft({ title: state.analysis.suggestedTitle });
    }
  }, [step, state.analysis]);

  /*
   * 到上限就把对应的选项面板收起来。
   * 打开它的按钮在满了之后是 disabled 的，面板却还开着 —— 里面每个按钮都点不动，
   * 看上去就是一块没有用的灰色区域。
   */
  useEffect(() => {
    if (tagEditing === "emotions" && activeStoryTags.emotions.length >= 2) setTagEditing(null);
    if (tagEditing === "themes" && activeStoryTags.themes.length >= 2) setTagEditing(null);
  }, [tagEditing, activeStoryTags.emotions.length, activeStoryTags.themes.length]);
  const updateStoryTags = (next: StoryTagSet | ((previous: StoryTagSet) => StoryTagSet)) => {
    setStoryTags((previous) => {
      const base = previous ?? activeStoryTags;
      return typeof next === "function" ? next(base) : next;
    });
  };
  const chooseEmotionTag = (option: (typeof moodOptions)[number]) => {
    updateStoryTags((previous) => {
      if (previous.emotions.some((tag) => tag.value === option.id)) {
        const emotions = previous.emotions.filter((tag) => tag.value !== option.id);
        return { ...previous, emotions: emotions.length ? emotions : previous.emotions };
      }
      const nextTag = { value: option.id, labelZh: option.zh, labelEn: option.en };
      const emotions =
        previous.emotions.length >= 2 ? [previous.emotions[0], nextTag] : [...previous.emotions, nextTag];
      return { ...previous, emotions };
    });
  };
  const removeEmotionTag = (value: string) =>
    updateStoryTags((previous) => {
      const emotions = previous.emotions.filter((tag) => tag.value !== value);
      return { ...previous, emotions: emotions.length ? emotions : previous.emotions };
    });
  const chooseEventTypeTag = (eventType: StoryEventTypeTag) => {
    updateStoryTags((previous) => ({
      ...previous,
      eventType:
        previous.eventType.value === eventType.value ? getFallbackEventType(draft.guide, state.analysis) : eventType,
    }));
    setTagEditing(null);
  };
  const removeThemeTag = (value: string) =>
    updateStoryTags((previous) => {
      const removed = previous.themes.find((tag) => tag.value === value);
      if (removed)
        setRemovedThemeTags((items) => [removed, ...items.filter((item) => item.value !== value)].slice(0, 4));
      return { ...previous, themes: previous.themes.filter((tag) => tag.value !== value) };
    });
  const restoreThemeTag = (tag: StoryThemeTag) => {
    if (activeStoryTags.themes.length >= 2 || activeStoryTags.themes.some((item) => item.value === tag.value)) return;
    updateStoryTags((previous) => ({ ...previous, themes: [...previous.themes, tag] }));
    setRemovedThemeTags((items) => items.filter((item) => item.value !== tag.value));
  };
  const addCustomThemeTag = () => {
    const value = customTheme.trim();
    if (!value) return;
    /*
     * 长度上限要看写的是哪种文字。原来一律按「最多 2 个字」算，
     * 那是中文的规矩 —— 英文模式下任何超过两个字母的词都会被拒，等于根本加不了主题。
     */
    const hasCJK = /[一-鿿]/.test(value);
    const cjkLength = Array.from(value).length;
    const englishWords = value.split(/\s+/).filter(Boolean).length;
    const invalidLength = hasCJK ? cjkLength < 2 || cjkLength > 6 : englishWords < 1 || englishWords > 3;
    if (invalidLength) {
      setThemeTagError(language === "zh" ? "中文主题需要 2–6 个字" : "Use 1–3 words");
      return;
    }
    if (activeStoryTags.themes.some((tag) => tag.value === value)) {
      setThemeTagError(language === "zh" ? "这个主题已经存在" : "That theme is already added");
      return;
    }
    if (activeStoryTags.themes.length >= 2) {
      setThemeTagError(language === "zh" ? "主题最多 2 个" : "Up to 2 themes");
      return;
    }
    updateStoryTags((previous) => ({
      ...previous,
      themes: [...previous.themes, { value, status: "approved" as const }],
    }));
    setCustomTheme("");
    setThemeTagError("");
    setTagEditing(null);
  };

  return (
    <main
      className={`story-editor-page ${themeMode === "night" ? "theme-night" : ""} ${focusMode && step === 1 ? "focus-mode-page" : ""}`}
    >
      {!(focusMode && step === 1) && (
        <header className="story-editor-header app-shell-header">
          <AppLogo onClick={onHome} />
          <div />
          <div className="story-editor-tools">
            <ThemeToggle language={language} themeMode={themeMode} onChange={onThemeModeChange} />
            <LanguageSelect language={language} onChange={(language) => update({ language })} />
          </div>
        </header>
      )}

      {step === 0 && (
        <section className="story-editor-stage">
          <div className="section-intro guide-intro-copy">
            <p className="eyebrow">{text.guideStep}</p>
            <h1>
              {language === "zh" ? (
                <>
                  你最想讲的
                  <br />
                  那个故事是什么？
                </>
              ) : (
                text.guideTitle
              )}
            </h1>
            <p>{text.guideSub}</p>
          </div>
          <GuideStack draft={draft} updateDraft={updateDraft} language={language} />
          <div className="stack-actions">
            <div className="stack-status">
              {guide ? (
                <>
                  <b>
                    {language === "zh" ? "已选择" : "Selected"} · {language === "zh" ? guide.title : guide.en}
                  </b>
                  <span>{guide.prompt}</span>
                </>
              ) : (
                <>
                  <b>
                    {language === "zh" ? `看看这 ${guides.length} 种入口` : `Explore ${guides.length} entry points`}
                  </b>
                  <span>
                    {language === "zh"
                      ? "没有合适的？最后一张卡可以自己写。"
                      : "Nothing fits? The last card lets you write your own."}
                  </span>
                </>
              )}
            </div>
            <PrimaryButton disabled={!canContinueGuide} onClick={() => update({ storyEditorStep: 1 })}>
              {text.continueWithPrompt}
            </PrimaryButton>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className={`collection-layout ${focusMode ? "focus-mode" : ""}`}>
          <aside className="prompt-panel">
            <button className="text-button" onClick={() => (focusMode ? setFocusMode(false) : requestStep(0))}>
              <ArrowLeft size={16} /> {!focusMode && text.changeGuide}
            </button>
            <Pill tone="lime">{guide ? (language === "zh" ? guide.title : guide.en) : ""}</Pill>
            <div className="panel-detail">
              {/* 标题已经由上面的 Pill 显示了，这里不再重复一次 */}
              <h2>{guidePrompt}</h2>
              <p>
                <b>{language === "zh" ? "可以从这个例子开始" : "Start from an example"}</b>
                {guide?.examples}
              </p>
            </div>
            <div className="save-state" data-status={saveStatus}>
              {saveStatus === "editing" ? (
                <>
                  <i className="save-dot" /> {language === "zh" ? "正在写…" : "Writing…"}
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <Check size={15} /> {text.saved} · {savedTime}
                </>
              ) : (
                <>
                  <Check size={15} /> {text.autosave}
                </>
              )}
            </div>
          </aside>
          <div className="story-form">
            <div className="story-form-title">
              <div>
                <p className="eyebrow">{text.storyStep}</p>
                <h1>
                  {text.storyH1}
                  <span className="serif">{text.storyH1b}</span>
                </h1>
              </div>
              <div className="story-input-tools">
                <button
                  className={`tool-line-button voice-button ${speechState !== "idle" ? "is-active" : ""}`}
                  onClick={() => void toggleSpeechInput()}
                  disabled={speechState === "processing"}
                  aria-pressed={speechState === "listening"}
                >
                  <Mic size={18} />
                  <span>
                    {speechState === "listening"
                      ? language === "zh"
                        ? "结束录音"
                        : "Stop recording"
                      : speechState === "processing"
                        ? language === "zh"
                          ? "正在转文字…"
                          : "Transcribing…"
                        : language === "zh"
                          ? "语音输入"
                          : "Voice input"}
                  </span>
                </button>
                <button className="tool-line-button focus-line" onClick={() => setFocusMode((value) => !value)}>
                  <span className={`switch ${focusMode ? "on" : ""}`}>
                    <i />
                  </span>
                  <span>{language === "zh" ? "开启专注模式" : "Turn on focus mode"}</span>
                </button>
                {speechError && (
                  <p className="voice-error" role="alert">
                    {speechError}
                  </p>
                )}
              </div>
            </div>
            <label>
              <span className="field-name">
                {text.title} <small>{text.optionalFill}</small>
              </span>
              <input
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value, edits: draft.edits + 1 })}
                placeholder={text.titleHint}
              />
            </label>
            <label>
              {text.yourStory}
              <textarea
                value={draft.body}
                maxLength={STORY_BODY_MAX_LENGTH}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted.trim().length >= Math.max(120, draft.body.trim().length * 0.8)) setPasteDialog(true);
                  updateDraft({ pastedChars: draft.pastedChars + pasted.length });
                }}
                onChange={(e) => updateDraft({ body: e.target.value, edits: draft.edits + 1 })}
                placeholder={draft.body ? "" : blankPrompts[language][idlePromptIndex]}
              />
              <span className={`count ${draft.body.length > STORY_BODY_MAX_LENGTH ? "warn" : ""}`}>
                {storyBodyLength} / {text.count}
              </span>
            </label>
            {resting && <div className="gentle-tip">{text.restTip}</div>}
            {draft.body.length > 0 && draft.body.length < 100 && !resting && (
              <div className="gentle-tip">{text.gentleTip}</div>
            )}
            {focusMode && (
              <p className="focus-note">
                {language === "zh"
                  ? "按 Esc 或再点一次开关，随时退出专注模式。"
                  : "Press Esc or toggle the switch again to leave focus mode anytime."}
              </p>
            )}
            <div className="meta-fields">
              <div className="field-group">
                <span className="field-label">{text.mood}</span>
                <div className="choice-row mood-row">
                  {moodOptions.map((option) => {
                    const label = language === "zh" ? option.zh : option.en;
                    const selected = [option.id, option.zh, option.en].includes(draft.mood);
                    return (
                      <button
                        className={selected ? "selected" : ""}
                        onClick={() => updateDraft({ mood: label })}
                        key={option.id}
                      >
                        <b>{option.icon}</b>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="field-grid">
                <label>
                  <span className="field-name">{text.lifeStage}</span>
                  <select required value={draft.stage} onChange={(e) => updateDraft({ stage: e.target.value })}>
                    <option value="">{text.choose}</option>
                    {stageOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {language === "zh" ? o.value : o.en}
                      </option>
                    ))}
                  </select>
                </label>
                <CityField draft={draft} updateDraft={updateDraft} label={text.city} language={language} />
                <AgeField draft={draft} updateDraft={updateDraft} text={text} />
                <GenderField draft={draft} updateDraft={updateDraft} text={text} />
              </div>
              {draft.gender === "其他" && (
                <p className="gender-hint">
                  {text.genderOtherHint}
                  <small>{text.genderOtherNote}</small>
                </p>
              )}
              {(showCityHint || showAgeHint) && (
                <div className="ai-hint">
                  <Sparkles size={15} />
                  <span>{text.aiRead}</span>
                  {showCityHint && hints.city && (
                    <button
                      onClick={() =>
                        updateDraft({
                          city: hints.city!.name,
                          cityNameEn: hints.city!.nameEn,
                          cityCountry: hints.city!.country,
                          cityLat: hints.city!.lat,
                          cityLon: hints.city!.lon,
                        })
                      }
                    >
                      {language === "zh"
                        ? `填入城市「${hints.city.name}」`
                        : `Use ${hints.city.nameEn || hints.city.name}`}
                    </button>
                  )}
                  {showAgeHint && (
                    <button onClick={() => updateDraft({ age: String(hints.age) })}>
                      {language === "zh" ? `填入年龄「${hints.age} 岁」` : `Use age ${hints.age}`}
                    </button>
                  )}
                  <small>{text.aiHintNote}</small>
                </div>
              )}
              <div className="field-group">
                <span className="field-label">
                  {text.people} <small>{text.multi}</small>
                </span>
                <div className="chip-row">
                  {peopleOptions.map((o) => (
                    <button
                      className={draft.people.includes(o.value) ? "selected" : ""}
                      onClick={() => choosePerson(o.value)}
                      key={o.value}
                    >
                      {language === "zh" ? o.value : o.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {!focusMode && (
              <div className="stage-actions split story-submit-only">
                <span className={`completion-hint ${submitAttempted && !canContinueCollection ? "warn" : ""}`}>
                  {submitAttempted && !canContinueCollection
                    ? language === "zh"
                      ? `还差一点：记得填${missingCollection.join("、")}。`
                      : `Almost there: remember to fill out ${missingCollection.join(", ")}.`
                    : language === "zh"
                      ? "完善故事信息后，就可以生成你的故事页面。"
                      : "Complete the story details to generate your story page."}
                </span>
                <PrimaryButton
                  onClick={() => {
                    if (!canContinueCollection) {
                      setSubmitAttempted(true);
                      return;
                    }
                    setFocusMode(false);
                    update({ storyEditorStep: 2 });
                  }}
                >
                  {text.ai}
                </PrimaryButton>
              </div>
            )}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="analysis-stage">
          <div className="analysis-orbit">
            <span className="pulse-star">✦</span>
            {[0, 1, 2].map((i) => (
              <i key={i} className={`analysis-ring ring-${i}`} />
            ))}
          </div>
          <p className="eyebrow">{language === "zh" ? "AI 只整理，不改写" : "AI organizes, never rewrites"}</p>
          <h1>
            {state.analysis
              ? language === "zh"
                ? "每段故事，都值得被认真倾听"
                : "Every story deserves to be heard with care"
              : language === "zh"
                ? "正在认真听你的故事……"
                : "Listening carefully to your story…"}
          </h1>
          <div className="analysis-steps analysis-steps-copy">
            {[
              [
                language === "zh" ? "步骤 1" : "Step 1",
                "",
                language === "zh" ? "正在整理你的故事……" : "Organizing your story…",
              ],
              [
                language === "zh" ? "步骤 2" : "Step 2",
                "",
                language === "zh" ? "正在理解故事内容……" : "Understanding the story…",
              ],
              [
                language === "zh" ? "步骤 3" : "Step 3",
                "",
                language === "zh" ? "正在创作你的专属故事画册……" : "Creating your personal story album…",
              ],
            ].map(([stepLabel, enLabel, label], i) => (
              <div
                className={analysisStage > i || state.analysis ? "done" : i === analysisStage ? "current" : ""}
                key={label}
              >
                <span>{analysisStage > i || state.analysis ? <Check size={15} /> : i + 1}</span>
                <b>
                  {stepLabel} {enLabel}
                </b>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <div className="analysis-detect">
            <span>{language === "zh" ? "已识别" : "Detected"}</span>
            <b>
              <MapPin size={13} /> {draft.city || (language === "zh" ? "未填写城市" : "City missing")}
            </b>
            <b>
              {draft.age
                ? `${draft.age} ${language === "zh" ? "岁" : "years old"}`
                : language === "zh"
                  ? "未填写年龄"
                  : "Age missing"}
            </b>
            {draft.cityLat !== null && <b>{formatCoords(draft.cityLat, draft.cityLon)}</b>}
          </div>
          <p className="analysis-quote">
            {state.analysis?.workflowStatus === "pending_review"
              ? language === "zh"
                ? "故事已经安全保存，并交给人工温和确认；确认前不会公开。"
                : "Your story is safely saved for a gentle human review and will stay private until then."
              : language === "zh"
                ? "“每段故事，都值得被认真倾听。”"
                : "“Every story deserves to be heard with care.”"}
          </p>
          {analysisError && (
            <div className="operation-error" role="alert">
              <p>{analysisError}</p>
              <button className="button button-ghost" onClick={() => setAnalysisRequestVersion((value) => value + 1)}>
                {language === "zh" ? "重新尝试" : "Try again"}
              </button>
            </div>
          )}
          {state.analysis && (
            <PrimaryButton onClick={() => update({ storyEditorStep: 3 })}>
              {language === "zh" ? "查收你的故事页面" : "Open your story page"}
            </PrimaryButton>
          )}
        </section>
      )}

      {/*
        直接打开 /StoryPage 但还没有分析结果时（例如刷新或尚未填写故事），
        原本整页什么都不渲染 —— 只剩一个页头，看起来像崩了。这里给一个明确出口。
      */}
      {step === 3 && !state.analysis && (
        <section className="story-editor-stage">
          <div className="section-intro guide-intro-copy">
            <p className="eyebrow">{text.finalSay}</p>
            <h1>{language === "zh" ? <>这一步还没有内容</> : <>Nothing to confirm yet</>}</h1>
            <p>
              {language === "zh"
                ? "这一页需要先完成前面的写作和故事整理。可能是刷新后草稿还没有恢复。"
                : "This page needs the writing and story pass first. Your draft may not have reloaded yet."}
            </p>
          </div>
          <div className="stage-actions">
            <PrimaryButton onClick={() => update({ storyEditorStep: 0 })}>
              {language === "zh" ? "回到第一步" : "Back to step one"}
            </PrimaryButton>
          </div>
        </section>
      )}
      {step === 3 && state.analysis && (
        <section className="confirm-layout">
          <div className="confirm-story story-page-editor">
            <p className="eyebrow">{text.finalSay}</p>
            <h1>{text.confirmTitle}</h1>
            <div className="compact-edit-grid">
              {/* 四个 label 都统一用 .field-name 包住标题文字，标签行等高，控件才会对齐 */}
              <label>
                <span className="field-name">{text.storyTitle}</span>
                <input
                  value={draft.title}
                  placeholder={state.analysis.suggestedTitle}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                />
              </label>
              <CityField draft={draft} updateDraft={updateDraft} label={text.confirmPlace} language={language} />
              <AgeField draft={draft} updateDraft={updateDraft} text={text} />
              <GenderField draft={draft} updateDraft={updateDraft} text={text} />
              <label>
                <span className="field-name">{text.lifeStage}</span>
                <select required value={draft.stage} onChange={(e) => updateDraft({ stage: e.target.value })}>
                  <option value="">{text.choose}</option>
                  {stageOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {language === "zh" ? o.value : o.en}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {draft.gender === "其他" && (
              <p className="gender-hint">
                {text.genderOtherHint}
                <small>{text.genderOtherNote}</small>
              </p>
            )}
            <article className="story-preview editable-preview">
              <div className="preview-head">
                <h2>{draft.title || state.analysis.suggestedTitle}</h2>
                <button onClick={() => setEditingBody(!editingBody)}>
                  {editingBody ? text.doneEdit : text.editBody}
                </button>
              </div>
              {editingBody ? (
                <textarea
                  value={draft.body}
                  maxLength={STORY_BODY_MAX_LENGTH}
                  onChange={(e) => {
                    setPublishError("");
                    updateDraft({ body: e.target.value, edits: draft.edits + 1 });
                  }}
                />
              ) : (
                <p>{draft.body}</p>
              )}
              <span className={`count ${storyBodyLengthValid ? "" : "warn"}`}>
                {storyBodyLength} / {text.count}
              </span>
            </article>
          </div>
          <div className="tag-editor">
            <div className="tag-editor-head">
              <Sparkles size={20} />
              <div>
                <h2>{language === "zh" ? "智能分析结果" : "Smart analysis"}</h2>
                <p>
                  {language === "zh" ? (
                    <>
                      你可以根据自己的理解增加或删除标签，
                      <br />
                      也可以增加「其他」标签
                    </>
                  ) : (
                    <>
                      Add or remove tags based on your own reading.
                      <br />
                      Remove an AI theme first, then add your own.
                    </>
                  )}
                </p>
              </div>
            </div>
            <section className="story-tags-panel" aria-label={language === "zh" ? "故事标签" : "Story tags"}>
              <div className="story-tag-layer">
                <span>{language === "zh" ? "情感" : "Emotion"}</span>
                <div className="story-tag-body">
                  <div className="story-tag-chips">
                    {activeStoryTags.emotions.map((tag) => (
                      <button className="story-tag-chip" key={tag.value} onClick={() => removeEmotionTag(tag.value)}>
                        {language === "zh" ? tag.labelZh : (tag.labelEn ?? tag.labelZh)}
                        <X size={13} />
                      </button>
                    ))}
                    <button
                      className="add-tag story-tag-edit"
                      disabled={activeStoryTags.emotions.length >= 2}
                      onClick={() => setTagEditing(tagEditing === "emotions" ? null : "emotions")}
                    >
                      {activeStoryTags.emotions.length
                        ? language === "zh"
                          ? "更改"
                          : "Change"
                        : language === "zh"
                          ? "添加"
                          : "Add"}
                    </button>
                    <small className="tag-limit">{language === "zh" ? "最多 2 个" : "Up to 2"}</small>
                  </div>
                  {tagEditing === "emotions" && (
                    <div className="tag-popover tag-option-grid">
                      {moodOptions.map((option) => (
                        <button
                          className={
                            activeStoryTags.emotions.some((tag) => tag.value === option.id)
                              ? "tag-option selected"
                              : "tag-option"
                          }
                          key={option.id}
                          onClick={() => chooseEmotionTag(option)}
                        >
                          <b>{option.icon}</b>
                          <span>{language === "zh" ? option.zh : option.en}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="story-tag-layer">
                <span>{language === "zh" ? "类型" : "Type"}</span>
                <div className="story-tag-body">
                  <div className="story-tag-chips">
                    <button
                      className="story-tag-chip event-type-chip"
                      onClick={() => setTagEditing(tagEditing === "eventType" ? null : "eventType")}
                    >
                      {language === "zh" ? activeStoryTags.eventType.labelZh : activeStoryTags.eventType.labelEn}
                    </button>
                    <button
                      className="add-tag story-tag-edit"
                      onClick={() => setTagEditing(tagEditing === "eventType" ? null : "eventType")}
                    >
                      {language === "zh" ? "更改" : "Change"}
                    </button>
                  </div>
                  {tagEditing === "eventType" && (
                    <div className="tag-popover event-tag-options">
                      {eventTypeTags
                        .filter((tag) => !enabledTypeIds || enabledTypeIds.has(tag.value))
                        .map((tag) => (
                          <button
                            className={
                              activeStoryTags.eventType.value === tag.value ? "tag-option selected" : "tag-option"
                            }
                            key={tag.value}
                            onClick={() => chooseEventTypeTag(tag)}
                          >
                            <span>{language === "zh" ? tag.labelZh : tag.labelEn}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="story-tag-layer">
                <span>{language === "zh" ? "主题" : "Theme"}</span>
                <div className="story-tag-body">
                  <div className="story-tag-chips">
                    {activeStoryTags.themes.map((tag) => (
                      <button className="story-tag-chip" key={tag.value} onClick={() => removeThemeTag(tag.value)}>
                        {getThemeLabel(tag.value, language)}
                        <X size={13} />
                      </button>
                    ))}
                    <button
                      className="add-tag story-tag-edit"
                      disabled={activeStoryTags.themes.length >= 2}
                      onClick={() => setTagEditing(tagEditing === "themes" ? null : "themes")}
                    >
                      {language === "zh" ? "＋ 其他" : "+ Custom"}
                    </button>
                    <small className="tag-limit">{language === "zh" ? "最多 2 个" : "Up to 2"}</small>
                  </div>
                  {removedThemeTags.length > 0 && (
                    <div className="theme-restore-row">
                      <span>{language === "zh" ? "最近移除" : "Recently removed"}</span>
                      {removedThemeTags.map((tag) => (
                        <button
                          key={tag.value}
                          disabled={activeStoryTags.themes.length >= 2}
                          onClick={() => restoreThemeTag(tag)}
                        >
                          ↶ {getThemeLabel(tag.value, language)}
                        </button>
                      ))}
                    </div>
                  )}
                  {tagEditing === "themes" && (
                    <div className="tag-popover custom-theme-editor">
                      <div className="custom-theme-row">
                        <input
                          value={customTheme}
                          maxLength={16}
                          placeholder={
                            language === "zh" ? "2–6 个字，例如「重新出发」" : "1–3 words, e.g. Starting again"
                          }
                          onChange={(event) => {
                            setCustomTheme(event.target.value);
                            setThemeTagError("");
                          }}
                        />
                        <button
                          className="button button-ghost"
                          disabled={activeStoryTags.themes.length >= 2}
                          onClick={addCustomThemeTag}
                        >
                          {language === "zh" ? "添加" : "Add"}
                        </button>
                      </div>
                      <small className={themeTagError ? "tag-error" : "tag-helper"}>
                        {themeTagError ||
                          (language === "zh"
                            ? "请先删除一个 AI 主题，再补充自己的主题。"
                            : "Remove an AI theme first, then add your own.")}
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </section>
            <fieldset className="image-style-picker">
              <legend>{text.styleLegend}</legend>
              <p>{text.styleHint}</p>
              <div className="image-style-options">
                {imageStyleOptions.map((option) => {
                  const styleLabel = language === "zh" ? option.label : option.labelEn;
                  return (
                    <label
                      className={`image-style-option ${imageStyle === option.id ? "selected" : ""}`}
                      key={option.id}
                    >
                      <input
                        type="radio"
                        name="image-style"
                        value={option.id}
                        checked={imageStyle === option.id}
                        onChange={() => selectImageStyle(option.id)}
                      />
                      <span className="image-style-copy">
                        <b>{styleLabel}</b>
                        <small>{language === "zh" ? option.description : option.descriptionEn}</small>
                      </span>
                      <span className="image-style-peek">
                        <Eye size={14} />
                        {text.stylePeek}
                      </span>
                      <figure className="image-style-popover">
                        <img
                          src={option.preview}
                          alt={language === "zh" ? `${styleLabel}示意图` : `${styleLabel} sample`}
                        />
                        <figcaption>{styleLabel}</figcaption>
                      </figure>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="comic-preview">
              <div className={`comic-frame ${storyImage ? "generated single-story-image" : ""}`}>
                {storyImage ? (
                  <img src={storyImage} alt={`《${draft.title || state.analysis!.suggestedTitle}》的故事高光插画`} />
                ) : imageStatus === "generating" ? (
                  <div className="comic-state">
                    <LoaderCircle className="comic-spinner" size={38} />
                    <b>{text.imgSearching}</b>
                    <small>
                      {(() => {
                        const o = imageStyleOptions.find((x) => x.id === imageStyle);
                        return language === "zh"
                          ? `正在从正文里提取最值得画下来的瞬间，并准备一张${o?.label}插画`
                          : `Picking the moment worth drawing and preparing a ${o?.labelEn} illustration`;
                      })()}
                    </small>
                  </div>
                ) : imageStatus === "failed" ? (
                  <div className="comic-state">
                    <Sparkles className="comic-state-icon" size={38} />
                    <b>{text.imgFailed}</b>
                    <small>{imageError}</small>
                    <div className="comic-fallback-actions">
                      <button className="retry-comic" onClick={() => void runImageGeneration()}>
                        <RefreshCw size={15} />
                        重新生成图片
                      </button>
                      <button className="skip-comic" disabled={publishing} onClick={attemptPublish}>
                        {publishing ? "正在发布…" : "跳过图片，继续发布"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="comic-state">
                    <Sparkles className="comic-state-icon" size={38} />
                    <b>{text.imgIdle}</b>
                    <small>{text.imgIdleNote}</small>
                    <button className="retry-comic" onClick={() => void runImageGeneration()}>
                      生成故事图片
                    </button>
                  </div>
                )}
              </div>
              {storyImage && (
                <div className="comic-actions">
                  <button
                    className="download-comic"
                    onClick={() =>
                      downloadStoryImage(storyImage, draft.title || state.analysis!.suggestedTitle, imageStyle)
                    }
                  >
                    <Download size={16} />
                    下载故事图片
                  </button>
                  <button className="regenerate-comic" onClick={() => void runImageGeneration()}>
                    <RefreshCw size={15} />
                    重新生成
                  </button>
                </div>
              )}
              {storyHighlight && (
                <details className="comic-storyboard">
                  <summary>{text.imgStoryboard}</summary>
                  <div className="highlight-detail">
                    <b>{storyHighlight.title}</b>
                    <p>{storyHighlight.moment}</p>
                    <span>
                      {storyHighlight.scene} · {storyHighlight.action}
                    </span>
                    <em>{storyHighlight.emotion}</em>
                    {imagePrompt && (
                      <details>
                        <summary>查看绘画 Prompt</summary>
                        <p>{imagePrompt}</p>
                      </details>
                    )}
                  </div>
                </details>
              )}
            </div>
            <div className="publish-note">
              <Check size={17} />
              {text.publishNote}
            </div>
            {publishError && (
              <p className="operation-error" role="alert">
                {publishError}
              </p>
            )}
            <PrimaryButton disabled={publishing || !storyBodyLengthValid} onClick={attemptPublish}>
              {publishing ? (language === "zh" ? "正在发布…" : "Publishing…") : text.publish}
            </PrimaryButton>
          </div>
        </section>
      )}
      {pasteDialog && (
        <div className="modal-backdrop">
          <div className="report-dialog">
            <h2>{text.pasteTitle}</h2>
            <div className="dialog-actions">
              <button className="button button-ghost" onClick={() => setPasteDialog(false)}>
                {text.pasteYes}
              </button>
              <button className="button button-primary" onClick={() => setPasteDialog(false)}>
                {text.pasteOther}
              </button>
            </div>
          </div>
        </div>
      )}
      {leaveTarget !== null && (
        <div className="modal-backdrop">
          <div className="report-dialog">
            <h2>{text.leaveTitle}</h2>
            <div className="dialog-actions three">
              <button className="button button-ghost" onClick={() => setLeaveTarget(null)}>
                {text.keepWriting}
              </button>
              <button className="button button-ghost" onClick={() => confirmLeave(false)}>
                {text.leaveAnyway}
              </button>
              <button className="button button-primary" onClick={() => confirmLeave(true)}>
                {text.saveDraft}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 第 3 步（AI 整理）按需求不做引导，所以这里只有 0 / 1 / 3 三个场景 */}
      {storyEditorTourScene && !pasteDialog && leaveTarget === null && (
        <Tour scene={storyEditorTourScene} language={state.language} onFinish={onTourFinish} onSkip={onTourSkip} />
      )}
    </main>
  );
}
