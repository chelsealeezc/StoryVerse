import { useEffect, useState } from "react";
import { Check, Flag, Heart, RefreshCw, Sparkles, ThumbsDown, X } from "lucide-react";
import { LanguageSelect, AppLogo, Pill, PrimaryButton, ThemeToggle } from "../../components/AppControls";
import { uiCopy as copy } from "../../data/interface-content";
import { dataService } from "../../services/data-service";
import type { StoryRecommendation } from "../../services/data-service";
import type { AppState, Language, StoryReaction, Story } from "../../types/domain";
import type { ThemeMode } from "../../types/ui";

type RecommendedStory = Story & { recommendationReason: string };

const getVisualStatusLabel = (status: Story["visualStatus"], language: Language) => {
  const zh = {
    ready: "故事意象",
    generating: "意象正在生成",
    failed: "意象暂时迷路了",
    blocked: "意象未通过审核",
  };
  const en = {
    ready: "Story image",
    generating: "Generating the image",
    failed: "The image got lost for now",
    blocked: "Image did not pass review",
  };
  return (language === "zh" ? zh : en)[status];
};

function StoryDetail({
  story,
  reaction,
  onReactionChange,
  onClose,
  onReport,
  language,
}: {
  story: RecommendedStory;
  reaction: StoryReaction | null;
  onReactionChange: (reaction: StoryReaction | null) => void;
  onClose: () => void;
  onReport: () => void;
  language: Language;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <article className="story-modal">
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        <div className={`visual visual-${story.visualStatus}`}>
          {story.imageUrl ? <img src={story.imageUrl} alt="" /> : <span>✦</span>}
          <div>{getVisualStatusLabel(story.visualStatus, language)}</div>
        </div>
        <div className="story-content">
          <div className="story-meta">
            <Pill tone="lime">{story.theme}</Pill>
            <span>{story.city}</span>
            <span>{story.stage}</span>
            <span>{story.readMinutes} 分钟阅读</span>
          </div>
          <h1>{story.title}</h1>
          <p className="author">@{story.author} · 匿名分享</p>
          {story.recommendationReason && (
            <div className="reason">
              <Sparkles size={16} />
              <span>
                <b>为什么推荐给你</b>
                {story.recommendationReason}
              </span>
            </div>
          )}
          <p className="story-body">{story.body}</p>
          <div className="tag-row">
            <Pill>{story.emotion}</Pill>
            <Pill>{story.meaning}</Pill>
            <Pill>{story.perspective}</Pill>
          </div>
        </div>
        <footer className="story-actions">
          <div>
            <button
              className={reaction === "like" ? "active like" : ""}
              onClick={() => onReactionChange(reaction === "like" ? null : "like")}
            >
              <Heart size={19} />
              喜欢
            </button>
            <button
              className={reaction === "dislike" ? "active dislike" : ""}
              onClick={() => onReactionChange(reaction === "dislike" ? null : "dislike")}
            >
              <ThumbsDown size={19} />
              不喜欢
            </button>
          </div>
          <button onClick={onReport}>
            <Flag size={18} />
            举报
          </button>
        </footer>
      </article>
    </div>
  );
}

function ReportDialog({
  story,
  onClose,
  onSubmit,
}: {
  story: Story;
  onClose: () => void;
  onSubmit?: (reason: string, note: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  if (done)
    return (
      <div className="modal-backdrop">
        <div className="report-dialog success-dialog">
          <span className="success-icon">
            <Check size={28} />
          </span>
          <h2>举报已受理</h2>
          <p>谢谢你帮助守护故事社区。审核前不会向故事作者公开你的身份。</p>
          <PrimaryButton onClick={onClose}>返回故事</PrimaryButton>
        </div>
      </div>
    );
  return (
    <div className="modal-backdrop">
      <div className="report-dialog">
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        {!confirm ? (
          <>
            <Pill tone="orange">社区安全</Pill>
            <h2>举报「{story.title}」</h2>
            <p>请选择最符合的原因。举报说明仅供审核人员查看。</p>
            <div className="report-reasons">
              {["隐私泄露", "仇恨或骚扰", "危险内容", "垃圾内容", "其他"].map((x) => (
                <button className={reason === x ? "selected" : ""} onClick={() => setReason(x)} key={x}>
                  {reason === x && <Check size={15} />}
                  {x}
                </button>
              ))}
            </div>
            <label>
              补充说明 <small>选填</small>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="请提供有助于审核的上下文…"
              />
            </label>
            <PrimaryButton disabled={!reason} onClick={() => setConfirm(true)}>
              检查并继续
            </PrimaryButton>
          </>
        ) : (
          <>
            <Pill tone="orange">二次确认</Pill>
            <h2>确认提交这次举报？</h2>
            <div className="confirm-report">
              <span>举报原因</span>
              <b>{reason}</b>
              {note && <p>{note}</p>}
            </div>
            <p>提交后会进入人工审核队列。请确认信息准确。</p>
            <div className="dialog-actions">
              <button className="button button-ghost" onClick={() => setConfirm(false)}>
                返回修改
              </button>
              <button
                className="button button-danger"
                onClick={() => {
                  void (onSubmit ? onSubmit(reason, note) : Promise.resolve()).then(() => setDone(true));
                }}
              >
                确认提交举报
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function RecommendationsPage({
  state,
  update,
  onEnterStarLobby,
  onHome,
  themeMode,
  onThemeModeChange,
}: {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  onEnterStarLobby: () => void;
  onHome: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (themeMode: ThemeMode) => void;
}) {
  const [selectedStory, setSelectedStory] = useState<RecommendedStory | null>(null);
  const [reportStory, setReportStory] = useState<Story | null>(null);
  const [recommendations, setRecommendations] = useState<StoryRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadRecommendations = (refresh = false) => {
    setIsLoading(true);
    return (refresh ? dataService.refreshRecommendations() : dataService.listRecommendations())
      .then(setRecommendations)
      .catch((error) => {
        console.info("[StoryVerse] Recommendations are temporarily unavailable.", error);
        setRecommendations([]);
      })
      .finally(() => setIsLoading(false));
  };
  useEffect(() => {
    void loadRecommendations();
  }, [state.language]);
  const recommendedStories: RecommendedStory[] = recommendations.map((item) => ({
    ...item.story,
    recommendationReason: item.reason,
  }));
  const openStory = (story: RecommendedStory) => {
    if (!state.openedRecommendationStoryIds.includes(story.id))
      update({ openedRecommendationStoryIds: [...state.openedRecommendationStoryIds, story.id] });
    setSelectedStory(story);
  };
  const updateStoryReaction = (id: string, reaction: StoryReaction | null) => {
    update({ reactions: { ...state.reactions, [id]: reaction } });
    void (reaction ? dataService.setReaction(id, reaction) : dataService.clearReaction(id));
  };
  return (
    <main className={`recommendations-page ${themeMode === "night" ? "theme-night" : ""}`}>
      <header className="topbar app-shell-header">
        <AppLogo onClick={onHome} />
        <div className="topbar-actions">
          <ThemeToggle language={state.language} themeMode={themeMode} onChange={onThemeModeChange} />
          <LanguageSelect language={state.language} onChange={(language) => update({ language })} />
        </div>
      </header>
      <section className="recommendations-heading">
        <div>
          <p className="eyebrow">FIRST CONSTELLATION</p>
          <h1>
            为你找到的<span className="serif">五则故事。</span>
          </h1>
          <p>至少打开一则，就可以进入完整轻量星图。你不需要读完固定数量。</p>
        </div>
        <div className="recommendations-heading-actions">
          <button className="button button-ghost" disabled={isLoading} onClick={() => void loadRecommendations(true)}>
            <RefreshCw size={16} />
            {state.language === "zh" ? "换一批" : "Refresh"}
          </button>
          <PrimaryButton disabled={state.openedRecommendationStoryIds.length < 1} onClick={onEnterStarLobby}>
            进入故事星图
          </PrimaryButton>
        </div>
      </section>
      <section className="recommendations-grid">
        {isLoading && <p>{state.language === "zh" ? "正在为你寻找故事…" : "Finding stories for you…"}</p>}
        {!isLoading && recommendedStories.length === 0 && (
          <p>
            {state.language === "zh"
              ? "故事池还没有足够的公开故事，稍后再来看看。"
              : "There aren't enough public stories yet. Check back a little later."}
          </p>
        )}
        {recommendedStories.map((story, i) => (
          <button className={`recommendations-card card-${i}`} onClick={() => openStory(story)} key={story.id}>
            <div className="recommendations-orbit">
              <span style={{ background: story.typeColor ?? "#C7CEDB" }} />
              <i />
            </div>
            <div className="recommendations-index">0{i + 1}</div>
            <div className="recommendations-meta">
              <Pill>{story.theme}</Pill>
              <span>{story.city}</span>
            </div>
            <h2>{story.title}</h2>
            <p>{story.excerpt}</p>
            <div className="recommendations-reason">
              <Sparkles size={15} />
              {story.recommendationReason}
            </div>
            <footer>
              <span>
                {story.readMinutes} {copy[state.language].minutes}
              </span>
              <span>
                {state.openedRecommendationStoryIds.includes(story.id)
                  ? state.language === "zh"
                    ? "已打开 ✓"
                    : "Opened ✓"
                  : state.language === "zh"
                    ? "阅读故事 →"
                    : "Read story →"}
              </span>
            </footer>
          </button>
        ))}
      </section>
      {selectedStory && (
        <StoryDetail
          story={selectedStory}
          reaction={state.reactions[selectedStory.id] ?? null}
          onReactionChange={(r) => updateStoryReaction(selectedStory.id, r)}
          onClose={() => setSelectedStory(null)}
          onReport={() => setReportStory(selectedStory)}
          language={state.language}
        />
      )}
      {reportStory && (
        <ReportDialog
          story={reportStory}
          onClose={() => setReportStory(null)}
          onSubmit={(reason, note) => dataService.createReport(reportStory.id, reason, note).then(() => undefined)}
        />
      )}
    </main>
  );
}
