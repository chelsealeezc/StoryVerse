import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleUserRound,
  Compass, Feather, Flag, Heart, House, Layers3, LogOut, Menu, Mic,
  Orbit, Search, SlidersHorizontal, Sparkles, ThumbsDown, X,
} from "lucide-react";
import { guides, icebreakers, mockAnalysis, stories } from "./data";
import { initialState, loadState, resetState, saveState } from "./storage";
import type { AppState, Reaction, ResonanceMode, Story } from "./types";

const themeColors: Record<string, string> = {
  家庭: "#ff5b45", 成长: "#b8eb00", 迁移: "#1769ff", 关系: "#ffcc23",
  工作: "#151515", 身份: "#9f7aea",
};

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="logo"><span className="logo-mark">✦</span>{!compact && <span>StoryVerse</span>}</div>;
}

function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function PrimaryButton({ children, onClick, disabled = false, className = "" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return <button className={`button button-primary ${className}`} onClick={onClick} disabled={disabled}>{children}<ArrowRight size={18} /></button>;
}

function Icebreaker({ onContinue }: { onContinue: () => void }) {
  const [selected, setSelected] = useState(icebreakers[0]);
  return (
    <main className="ice-page">
      <header className="topbar"><Logo /><Pill tone="lime">浏览功能 · 不计入首故事</Pill></header>
      <section className="ice-hero">
        <div className="hero-copy">
          <p className="eyebrow">欢迎来到故事的宇宙</p>
          <h1>每一颗星星，<br />都来自一个<span className="serif">真实的人。</span></h1>
          <p className="hero-body">有些故事很小，有些故事改变了一生。这里没有“正确的故事”，它们不需要完美，只需要是真实的。</p>
          <PrimaryButton onClick={onContinue}>开始我的旅程</PrimaryButton>
        </div>
        <div className="ice-orbit" aria-label="Icebreaker 故事星图">
          <div className="orbit-ring ring-a" />
          <div className="orbit-ring ring-b" />
          <div className="orbit-center">听见<br /><em>真实</em></div>
          {icebreakers.map((item, index) => (
            <button
              key={item.id}
              className={`ice-star ice-star-${index} ${selected.id === item.id ? "active" : ""}`}
              onClick={() => setSelected(item)}
              aria-label={item.question}
            ><span /></button>
          ))}
          <article className="ice-card">
            <div className="card-number">0{icebreakers.indexOf(selected) + 1} / 0{icebreakers.length}</div>
            <Pill>{selected.tag}</Pill>
            <h2>{selected.question}</h2>
            <p>{selected.answer}</p>
            <div className="card-nav">
              <button onClick={() => setSelected(icebreakers[(icebreakers.indexOf(selected) + icebreakers.length - 1) % icebreakers.length])}><ArrowLeft size={17} /></button>
              <button onClick={() => setSelected(icebreakers[(icebreakers.indexOf(selected) + 1) % icebreakers.length])}><ArrowRight size={17} /></button>
            </div>
          </article>
        </div>
      </section>
      <div className="principle-strip">
        <span>匿名展示</span><span>城市级标签</span><span>故事可撤回</span><span>AI 不替你写作</span>
      </div>
    </main>
  );
}

function Auth({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [agreed, setAgreed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = email.includes("@") && password.length >= 6 && (mode === "login" || agreed);
  return (
    <main className="auth-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> 返回暖场星空</button>
      <section className="auth-shell">
        <div className="auth-brand">
          <Logo />
          <div>
            <p className="eyebrow">你的旅程从这里开始</p>
            <h1>开始你的<br /><span className="serif">StoryVerse.</span></h1>
            <p>创建账户后，写下第一个正式故事，才能进入故事星图。</p>
          </div>
          <div className="journey">
            {["创建账户", "写下首故事", "选择共鸣", "进入星图"].map((label, i) => (
              <div className={i === 0 ? "current" : ""} key={label}><span>{i + 1}</span>{label}</div>
            ))}
          </div>
          <div className="mini-orbits"><span /><span /><span /><i>✦</i></div>
        </div>
        <div className="auth-form">
          <div className="segmented">
            <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>注册</button>
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>登录</button>
          </div>
          <div className="form-heading">
            <Pill tone="blue">LOCAL DEMO</Pill>
            <h2>{mode === "signup" ? "创建你的故事账户" : "欢迎回来"}</h2>
            <p>这是 localhost 演示，不会发送真实邮件或保存真实密码。</p>
          </div>
          <label>邮箱<input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" /></label>
          <label>密码<input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="至少 6 位" /></label>
          {mode === "signup" && (
            <label className="checkbox-row"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} /><span>我同意服务条款与隐私说明</span></label>
          )}
          <PrimaryButton disabled={!valid} onClick={onComplete}>{mode === "signup" ? "创建账户，写第一个故事" : "进入 StoryVerse"}</PrimaryButton>
          <div className="privacy-note"><Sparkles size={18} /><span><strong>你的解释权始终属于你。</strong><br />AI 只整理标签，不会改写你的正文。</span></div>
        </div>
      </section>
    </main>
  );
}

function Wizard({ state, update, onPublished }: {
  state: AppState; update: (patch: Partial<AppState>) => void; onPublished: () => void;
}) {
  const step = state.wizardStep;
  const draft = state.draft;
  const [analysisStage, setAnalysisStage] = useState(0);
  const saveTimer = useRef<number | null>(null);

  const setDraft = (patch: Partial<typeof draft>) => update({ draft: { ...draft, ...patch } });
  useEffect(() => {
    saveTimer.current = window.setInterval(() => setDraft({ saves: draft.saves + 1 }), 15000);
    return () => { if (saveTimer.current) clearInterval(saveTimer.current); };
  }, [draft.saves]);
  useEffect(() => {
    if (step !== 2) return;
    setAnalysisStage(0);
    const timers = [650, 1400, 2200].map((time, i) => window.setTimeout(() => setAnalysisStage(i + 1), time));
    const done = window.setTimeout(() => update({ analysis: mockAnalysis }), 2500);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, [step]);

  const choosePerson = (person: string) => {
    const people = draft.people.includes(person) ? draft.people.filter(p => p !== person) : [...draft.people, person];
    setDraft({ people });
  };
  const canContinueCollection = draft.body.trim().length >= 20 && draft.city && draft.time && draft.mood;
  const steps = ["选择引导", "写下故事", "AI 整理", "确认发布"];

  return (
    <main className="wizard-page">
      <header className="wizard-header">
        <Logo />
        <div className="stepper">{steps.map((label, i) => <div key={label} className={i <= step ? "active" : ""}><span>{i < step ? <Check size={13} /> : i + 1}</span>{label}</div>)}</div>
        <Pill tone="lime">首故事不可跳过</Pill>
      </header>

      {step === 0 && (
        <section className="wizard-stage">
          <div className="section-intro"><p className="eyebrow">第一步 · 找到故事的入口</p><h1>哪一种时刻，<br />正在<span className="serif">呼唤你？</span></h1><p>选择不是分类考试，只是给记忆一个可以开始的地方。</p></div>
          <div className="guide-grid">{guides.map((guide, i) => (
            <button key={guide.id} className={`guide-card ${draft.guide === guide.id ? "selected" : ""}`} onClick={() => setDraft({ guide: guide.id })}>
              <div className="guide-top"><span className="guide-icon">{guide.icon}</span><small>0{i + 1}</small></div>
              <h2>{guide.title}</h2><em>{guide.en}</em><p>{guide.prompt}</p><footer>{guide.examples}</footer>
            </button>
          ))}</div>
          <div className="stage-actions"><PrimaryButton disabled={!draft.guide} onClick={() => update({ wizardStep: 1 })}>带着这个提示继续</PrimaryButton></div>
        </section>
      )}

      {step === 1 && (
        <section className="collection-layout">
          <aside className="prompt-panel">
            <button className="text-button" onClick={() => update({ wizardStep: 0 })}><ArrowLeft size={16} /> 换一个引导</button>
            <Pill tone="lime">{guides.find(g => g.id === draft.guide)?.title}</Pill>
            <h2>{guides.find(g => g.id === draft.guide)?.prompt}</h2>
            <p>{guides.find(g => g.id === draft.guide)?.examples}</p>
            <div className="focus-toggle"><span><Orbit size={18} /> 专注模式</span><button aria-label="专注模式开关"><i /></button></div>
            <div className="save-state"><Check size={16} /> 草稿已保存 · {draft.saves} 次</div>
          </aside>
          <div className="story-form">
            <div className="story-form-title"><div><p className="eyebrow">第二步 · Story Collection</p><h1>顺着想法，<span className="serif">慢慢写。</span></h1></div><button className="icon-button" title="语音转文字将在后续版本开放"><Mic size={20} /></button></div>
            <label>标题 <small>选填</small><input value={draft.title} onChange={e => setDraft({ title: e.target.value, edits: draft.edits + 1 })} placeholder="不用着急取标题，先顺着想法写一些吧" /></label>
            <label>你的故事<textarea value={draft.body} onPaste={e => setDraft({ pastedChars: draft.pastedChars + e.clipboardData.getData("text").length })} onChange={e => setDraft({ body: e.target.value, edits: draft.edits + 1 })} placeholder="有没有一件事，让现在的你和以前不一样？" /><span className={`count ${draft.body.length > 1500 ? "warn" : ""}`}>{draft.body.length} / 建议 100–1500 字</span></label>
            {draft.body.length > 0 && draft.body.length < 100 && <div className="gentle-tip">这段记忆已经有了开头。再多写一点细节，AI 会更容易理解它。</div>}
            <div className="field-group"><span className="field-label">写完后的感受</span><div className="choice-row mood-row">{["沉重", "平静", "还好", "轻松", "温暖"].map((x, i) => <button className={draft.mood === x ? "selected" : ""} onClick={() => setDraft({ mood: x })} key={x}><b>{["☂", "◌", "○", "☀", "♥"][i]}</b>{x}</button>)}</div></div>
            <div className="two-fields">
              <label>故事发生在<select value={draft.time} onChange={e => setDraft({ time: e.target.value })}><option value="">请选择</option>{["今天", "最近一年", "小时候", "很久以前", "不确定"].map(x => <option key={x}>{x}</option>)}</select></label>
              <label>城市<select value={draft.city} onChange={e => setDraft({ city: e.target.value })}><option value="">主动选择城市</option>{["北京", "上海", "广州", "深圳", "成都", "昆明", "武汉", "杭州", "重庆"].map(x => <option key={x}>{x}</option>)}</select></label>
            </div>
            {(draft.time === "小时候" || draft.time === "很久以前") && <label>当时的人生阶段<select value={draft.stage} onChange={e => setDraft({ stage: e.target.value })}><option value="">请选择</option>{["童年", "中学", "大学", "青年探索", "初入职场", "成年回望"].map(x => <option key={x}>{x}</option>)}</select></label>}
            <div className="field-group"><span className="field-label">故事里有谁？ <small>可多选</small></span><div className="chip-row">{["自己", "家人", "恋人", "朋友", "陌生人", "老师", "同事"].map(x => <button className={draft.people.includes(x) ? "selected" : ""} onClick={() => choosePerson(x)} key={x}>{x}</button>)}</div></div>
            <div className="stage-actions split"><button className="button button-ghost" onClick={() => update({ wizardStep: 0 })}>上一步</button><PrimaryButton disabled={!canContinueCollection} onClick={() => update({ wizardStep: 2 })}>交给 AI 整理</PrimaryButton></div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="analysis-stage">
          <div className="analysis-orbit"><span className="pulse-star">✦</span>{[0,1,2].map(i => <i key={i} className={`analysis-ring ring-${i}`} />)}</div>
          <p className="eyebrow">AI 只整理，不改写</p>
          <h1>{state.analysis ? "故事已经整理好了。" : "正在认真听你的故事……"}</h1>
          <div className="analysis-steps">
            {["故事已收到", "正在理解故事内容", "正在寻找相呼应的主题"].map((label, i) => <div className={analysisStage > i || state.analysis ? "done" : i === analysisStage ? "current" : ""} key={label}><span>{analysisStage > i || state.analysis ? <Check size={15} /> : i + 1}</span>{label}</div>)}
          </div>
          <p className="analysis-quote">“每段故事，都值得被认真倾听。”</p>
          {state.analysis && <PrimaryButton onClick={() => update({ wizardStep: 3 })}>查看 AI 整理结果</PrimaryButton>}
        </section>
      )}

      {step === 3 && state.analysis && (
        <section className="confirm-layout">
          <div className="confirm-story">
            <p className="eyebrow">第四步 · 最终解释权属于你</p>
            <h1>确认你的<span className="serif">故事星点。</span></h1>
            <label>故事标题<input value={draft.title || state.analysis.suggestedTitle} onChange={e => setDraft({ title: e.target.value })} /></label>
            <article className="story-preview"><h2>{draft.title || state.analysis.suggestedTitle}</h2><p>{draft.body}</p><footer>{draft.city} · {draft.time} · {draft.mood}</footer></article>
          </div>
          <div className="tag-editor">
            <div className="tag-editor-head"><Sparkles size={20} /><div><h2>AI 整理结果</h2><p>点击标签可以移除；你随时可以修正 AI。</p></div></div>
            {Object.entries(state.analysis.tags).map(([layer, tags]) => <div className="tag-layer" key={layer}><span>{({topic:"主题", emotion:"情绪", meaning:"意义", perspective:"视角"} as Record<string,string>)[layer]}</span><div>{tags.map(tag => <button key={tag}>{tag}<X size={13} /></button>)}<button className="add-tag">＋ 替换</button></div></div>)}
            <div className="arc"><span>叙事轨迹</span>{state.analysis.arc.map((x, i) => <div key={x}><b>{i + 1}</b>{x}</div>)}</div>
            <div className="publish-note"><Check size={17} />确认后将进入模拟安全检查，并匿名加入故事池。</div>
            <PrimaryButton onClick={onPublished}>点亮我的故事星点</PrimaryButton>
          </div>
        </section>
      )}
    </main>
  );
}

function Resonance({ state, update, onContinue }: { state: AppState; update: (patch: Partial<AppState>) => void; onContinue: () => void }) {
  const dimensions = [
    { key: "city" as const, title: "城市", icon: "⌖", similar: "遇见来自相近城市语境的故事", different: "走进另一座城市的生活经验" },
    { key: "stage" as const, title: "人生阶段", icon: "◷", similar: "看看相近阶段的人如何走过", different: "听见另一段生命时期的声音" },
    { key: "theme" as const, title: "主题", icon: "✦", similar: "从熟悉的议题继续深入", different: "从新的主题打开另一扇门" },
  ];
  const setMode = (key: keyof AppState["resonance"], mode: ResonanceMode) => update({ resonance: { ...state.resonance, [key]: mode } });
  return (
    <main className="resonance-page">
      <header className="topbar"><Logo /><Pill tone="blue">故事已发布</Pill></header>
      <section className="resonance-hero">
        <div><p className="eyebrow">你的故事已经成为一颗星星</p><h1>接下来，想听见怎样的<span className="serif">回声？</span></h1><p>分别选择三个方向。相异不是随机，而是在仍然可理解的关联里，走进另一种生活。</p></div>
        <div className="new-star"><i /><span>你的星点</span><small>{state.draft.city || "未知城市"} · {state.draft.title || state.analysis?.suggestedTitle}</small></div>
      </section>
      <section className="dimension-grid">
        {dimensions.map(dim => <article key={dim.key} className="dimension-card">
          <div className="dimension-title"><span>{dim.icon}</span><div><small>共鸣维度</small><h2>{dim.title}</h2></div></div>
          <div className="mode-picker">
            <button className={state.resonance[dim.key] === "similar" ? "selected" : ""} onClick={() => setMode(dim.key, "similar")}><span>≈</span><b>与我相似</b><small>{dim.similar}</small></button>
            <button className={state.resonance[dim.key] === "different" ? "selected" : ""} onClick={() => setMode(dim.key, "different")}><span>↗</span><b>与我相异</b><small>{dim.different}</small></button>
          </div>
        </article>)}
      </section>
      <div className="resonance-action"><PrimaryButton onClick={onContinue}>寻找 5 则故事</PrimaryButton><small>随时可以在主页修改</small></div>
    </main>
  );
}

function StoryDetail({ story, reaction, onReact, onClose, onReport }: {
  story: Story; reaction: Reaction; onReact: (reaction: Reaction) => void; onClose: () => void; onReport: () => void;
}) {
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <article className="story-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className={`visual visual-${story.visualStatus}`}>
        <span>✦</span>
        <div>{story.visualStatus === "ready" ? "故事意象 · 本地占位" : story.visualStatus === "generating" ? "意象正在生成" : story.visualStatus === "failed" ? "意象暂时迷路了" : "意象未通过审核"}</div>
      </div>
      <div className="story-content">
        <div className="story-meta"><Pill tone="lime">{story.theme}</Pill><span>{story.city}</span><span>{story.stage}</span><span>{story.readMinutes} 分钟阅读</span></div>
        <h1>{story.title}</h1>
        <p className="author">@{story.author} · 匿名分享</p>
        {story.reason && <div className="reason"><Sparkles size={16} /><span><b>为什么推荐给你</b>{story.reason}</span></div>}
        <p className="story-body">{story.body}</p>
        <div className="tag-row"><Pill>{story.emotion}</Pill><Pill>{story.meaning}</Pill><Pill>{story.perspective}</Pill></div>
      </div>
      <footer className="story-actions">
        <div><button className={reaction === "like" ? "active like" : ""} onClick={() => onReact(reaction === "like" ? null : "like")}><Heart size={19} />喜欢</button><button className={reaction === "dislike" ? "active dislike" : ""} onClick={() => onReact(reaction === "dislike" ? null : "dislike")}><ThumbsDown size={19} />不喜欢</button></div>
        <button onClick={onReport}><Flag size={18} />举报</button>
      </footer>
    </article>
  </div>;
}

function ReportDialog({ story, onClose }: { story: Story; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <div className="modal-backdrop"><div className="report-dialog success-dialog"><span className="success-icon"><Check size={28} /></span><h2>举报已受理</h2><p>谢谢你帮助守护故事社区。审核前不会向故事作者公开你的身份。</p><PrimaryButton onClick={onClose}>返回故事</PrimaryButton></div></div>;
  return <div className="modal-backdrop"><div className="report-dialog">
    <button className="modal-close" onClick={onClose}><X size={18} /></button>
    {!confirm ? <><Pill tone="orange">社区安全</Pill><h2>举报「{story.title}」</h2><p>请选择最符合的原因。举报说明仅供审核人员查看。</p>
      <div className="report-reasons">{["隐私泄露", "仇恨或骚扰", "危险内容", "垃圾内容", "其他"].map(x => <button className={reason === x ? "selected" : ""} onClick={() => setReason(x)} key={x}>{reason === x && <Check size={15} />}{x}</button>)}</div>
      <label>补充说明 <small>选填</small><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="请提供有助于审核的上下文…" /></label>
      <PrimaryButton disabled={!reason} onClick={() => setConfirm(true)}>检查并继续</PrimaryButton>
    </> : <><Pill tone="orange">二次确认</Pill><h2>确认提交这次举报？</h2><div className="confirm-report"><span>举报原因</span><b>{reason}</b>{note && <p>{note}</p>}</div><p>提交后会进入人工审核队列。请确认信息准确。</p><div className="dialog-actions"><button className="button button-ghost" onClick={() => setConfirm(false)}>返回修改</button><button className="button button-danger" onClick={() => setDone(true)}>确认提交举报</button></div></>}
  </div></div>;
}

function Recommendations({ state, update, onEnterAtlas }: { state: AppState; update: (patch: Partial<AppState>) => void; onEnterAtlas: () => void }) {
  const [detail, setDetail] = useState<Story | null>(null);
  const [report, setReport] = useState<Story | null>(null);
  const recommended = stories.slice(0, 5).map((s, i) => ({
    ...s,
    reason: [
      "与你同样关注“归属”，但来自不同城市。",
      "处于相近的人生阶段，也在重新理解家人的沉默。",
      "来自不同城市，并用更轻盈的方式回应成长焦虑。",
      "与你的主题不同，却同样面对一次重要选择。",
      "城市和阶段都不同，但都在重新看见亲密关系。",
    ][i],
  }));
  const open = (story: Story) => {
    if (!state.openedRecommendations.includes(story.id)) update({ openedRecommendations: [...state.openedRecommendations, story.id] });
    setDetail(story);
  };
  const react = (id: string, reaction: Reaction) => {
    const likedAt = { ...state.likedAt };
    if (reaction === "like") likedAt[id] = Date.now(); else delete likedAt[id];
    update({ reactions: { ...state.reactions, [id]: reaction }, likedAt });
  };
  return <main className="recommend-page">
    <header className="topbar"><Logo /><div className="recommend-progress"><span>{state.openedRecommendations.length} / 5 已打开</span><div><i style={{ width: `${state.openedRecommendations.length * 20}%` }} /></div></div></header>
    <section className="recommend-heading"><div><p className="eyebrow">FIRST CONSTELLATION</p><h1>为你找到的<span className="serif">五则故事。</span></h1><p>至少打开一则，就可以进入完整轻量星图。你不需要读完固定数量。</p></div><PrimaryButton disabled={state.openedRecommendations.length < 1} onClick={onEnterAtlas}>进入故事星图</PrimaryButton></section>
    <section className="recommend-grid">
      {recommended.map((story, i) => <button className={`recommend-card card-${i}`} onClick={() => open(story)} key={story.id}>
        <div className="rec-orbit"><span style={{ background: themeColors[story.theme] }} /><i /></div>
        <div className="rec-index">0{i + 1}</div>
        <div className="rec-meta"><Pill>{story.theme}</Pill><span>{story.city}</span></div>
        <h2>{story.title}</h2><p>{story.excerpt}</p>
        <div className="rec-reason"><Sparkles size={15} />{story.reason}</div>
        <footer><span>{story.readMinutes} 分钟</span><span>{state.openedRecommendations.includes(story.id) ? "已打开 ✓" : "阅读故事 →"}</span></footer>
      </button>)}
    </section>
    {detail && <StoryDetail story={detail} reaction={state.reactions[detail.id] ?? null} onReact={r => react(detail.id, r)} onClose={() => setDetail(null)} onReport={() => setReport(detail)} />}
    {report && <ReportDialog story={report} onClose={() => setReport(null)} />}
  </main>;
}

function Atlas({ state, update, onWrite }: { state: AppState; update: (patch: Partial<AppState>) => void; onWrite: () => void }) {
  const [view, setView] = useState<"map" | "cards">("map");
  const [nav, setNav] = useState<"explore" | "mine" | "liked" | "resonance">("explore");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("全部");
  const [detail, setDetail] = useState<Story | null>(null);
  const [report, setReport] = useState<Story | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const visible = useMemo(() => {
    let list = stories;
    if (nav === "liked") list = list.filter(s => state.reactions[s.id] === "like").sort((a,b) => (state.likedAt[b.id] || 0) - (state.likedAt[a.id] || 0));
    if (theme !== "全部") list = list.filter(s => s.theme === theme);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(s => [s.title, s.city, s.stage, s.theme, s.emotion, s.body].join(" ").toLowerCase().includes(q));
    return list;
  }, [nav, theme, search, state.reactions, state.likedAt]);
  const react = (id: string, reaction: Reaction) => {
    const likedAt = { ...state.likedAt };
    if (reaction === "like") likedAt[id] = Date.now(); else delete likedAt[id];
    update({ reactions: { ...state.reactions, [id]: reaction }, likedAt });
  };
  const navItems = [
    { id: "explore", label: "探索故事", icon: Compass },
    { id: "mine", label: "我的故事", icon: CircleUserRound },
    { id: "resonance", label: "共鸣选择", icon: SlidersHorizontal },
    { id: "liked", label: "喜欢记录", icon: Heart },
  ] as const;
  return <main className="atlas-page">
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <Logo />
      <nav>{navItems.map(item => <button key={item.id} className={nav === item.id ? "active" : ""} onClick={() => {setNav(item.id); setMobileMenu(false);}}><item.icon size={19} />{item.label}{item.id === "liked" && <span>{Object.values(state.reactions).filter(x => x === "like").length}</span>}</button>)}</nav>
      <button className="write-button" onClick={onWrite}><Feather size={18} />写下新故事</button>
      <div className="sidebar-bottom"><div className="avatar">旅</div><div><b>星旅人 001</b><small>本地演示账户</small></div><button title="退出演示"><LogOut size={17} /></button></div>
    </aside>
    <section className="atlas-main">
      <header className="atlas-header">
        <button className="mobile-menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={20} /></button>
        <div className="search-box"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索情绪、城市、主题或人生转折" /><kbd>⌘ K</kbd></div>
        <div className="view-toggle"><button className={view === "map" ? "active" : ""} onClick={() => setView("map")}><Orbit size={17} />星图</button><button className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}><Layers3 size={17} />卡片</button></div>
      </header>
      <div className="atlas-title">
        <div><p className="eyebrow">{nav === "liked" ? "YOUR RESONANCE" : nav === "mine" ? "YOUR STORIES" : nav === "resonance" ? "RESONANCE SETTINGS" : "STORY ATLAS"}</p><h1>{nav === "liked" ? "曾与你产生共鸣的故事" : nav === "mine" ? "你的故事星点" : nav === "resonance" ? "调整故事相遇的方向" : "今天，想走进哪一种人生？"}</h1></div>
        <div className="atlas-stats"><div><b>{visible.length}</b><span>可见故事</span></div><div><b>6</b><span>主题星系</span></div></div>
      </div>
      {nav === "resonance" ? <div className="inline-resonance">
        {(["city","stage","theme"] as const).map((key, i) => <div key={key}><span>{["城市","人生阶段","主题"][i]}</span><div><button className={state.resonance[key] === "similar" ? "active" : ""} onClick={() => update({ resonance: {...state.resonance,[key]:"similar"} })}>≈ 与我相似</button><button className={state.resonance[key] === "different" ? "active" : ""} onClick={() => update({ resonance: {...state.resonance,[key]:"different"} })}>↗ 与我相异</button></div></div>)}
        <p><Sparkles size={17} />修改会立即影响下一次推荐。相异故事仍会保留一条可理解的连接。</p>
      </div> : <>
        <div className="filter-row"><button className="filter-icon"><SlidersHorizontal size={17} />筛选</button>{["全部","家庭","成长","迁移","关系","工作","身份"].map(x => <button className={theme === x ? "active" : ""} onClick={() => setTheme(x)} key={x}>{x}</button>)}</div>
        {visible.length === 0 ? <div className="empty-state"><span>✦</span><h2>这片星域暂时很安静</h2><p>试着清除搜索或放宽主题筛选。</p><button className="button button-ghost" onClick={() => {setSearch("");setTheme("全部");}}>清除筛选</button></div> :
        view === "map" ? <div className="star-map">
          <div className="map-orbit orbit-one" /><div className="map-orbit orbit-two" /><div className="map-orbit orbit-three" />
          <div className="map-label label-a">相似的回声</div><div className="map-label label-b">不同的人生</div>
          {visible.map((story, i) => <button key={story.id} className="map-node" style={{ left: `${story.x}%`, top: `${story.y}%`, "--node": themeColors[story.theme], "--size": `${38 + story.readMinutes * 5}px`, animationDelay: `${i * 70}ms` } as React.CSSProperties} onClick={() => setDetail(story)}>
            <i /><span className="node-card"><small>{story.theme} · {story.city}</small><b>{story.title}</b><em>{story.readMinutes} 分钟阅读</em></span>
          </button>)}
          <div className="map-legend"><span>星点大小 = 阅读长度</span>{Object.entries(themeColors).slice(0,4).map(([x,c]) => <span key={x}><i style={{background:c}} />{x}</span>)}</div>
        </div> : <div className="atlas-cards">{visible.map(story => <button onClick={() => setDetail(story)} key={story.id}><div className="story-color" style={{ background: themeColors[story.theme] }} /><div className="story-card-meta"><Pill>{story.theme}</Pill><span>{story.city} · {story.stage}</span></div><h2>{story.title}</h2><p>{story.excerpt}</p><footer><span>{story.readMinutes} 分钟阅读</span><ChevronRight size={17} /></footer></button>)}</div>}
      </>}
    </section>
    {detail && <StoryDetail story={detail} reaction={state.reactions[detail.id] ?? null} onReact={r => react(detail.id, r)} onClose={() => setDetail(null)} onReport={() => setReport(detail)} />}
    {report && <ReportDialog story={report} onClose={() => setReport(null)} />}
  </main>;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const update = (patch: Partial<AppState>) => setState(previous => ({ ...previous, ...patch }));
  useEffect(() => saveState(state), [state]);
  const go = (screen: string) => update({ screen });
  const resetDemo = () => { resetState(); setState({ ...initialState, draft: { ...initialState.draft, startedAt: Date.now() } }); };

  let content: React.ReactNode;
  if (state.screen === "icebreaker") content = <Icebreaker onContinue={() => update({ onboarded: true, screen: "auth" })} />;
  else if (state.screen === "auth") content = <Auth onBack={() => go("icebreaker")} onComplete={() => update({ accountCreated: true, screen: state.firstStoryComplete ? "atlas" : "wizard" })} />;
  else if (state.screen === "wizard") content = <Wizard state={state} update={update} onPublished={() => update({ firstStoryComplete: true, screen: "resonance" })} />;
  else if (state.screen === "resonance") content = <Resonance state={state} update={update} onContinue={() => go("recommendations")} />;
  else if (state.screen === "recommendations") content = <Recommendations state={state} update={update} onEnterAtlas={() => go("atlas")} />;
  else content = <Atlas state={state} update={update} onWrite={() => update({ screen: "wizard", wizardStep: 0 })} />;

  return <>{content}<button className="demo-reset" onClick={resetDemo} title="清除 localhost 演示进度"><House size={15} /> 重置演示</button></>;
}
