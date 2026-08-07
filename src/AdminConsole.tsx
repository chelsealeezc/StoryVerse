import { useMemo, useState } from "react";
import type { InboxMessage, ReviewBucket, ReviewItem } from "./types";
import "./admin.css";

type ThemeMode = "day" | "night";

const copy = {
  zh: {
    title: "内容审核台",
    lead: "只处理需要人来判断的故事。做完决定，作者会收到通知。",
    logout: "退出管理端",
    buckets: {
      reported: "被其它用户举报",
      uncertain: "审核系统不确定",
      appealed: "系统误判申诉",
    } as Record<ReviewBucket, string>,
    bucketHints: {
      reported: "有人点了举报",
      uncertain: "机器拿不准，作者选择仍然提交",
      appealed: "作者认为机器判错了",
    } as Record<ReviewBucket, string>,
    all: "全部待处理",
    empty: "这一类暂时没有待处理的故事。",
    pickOne: "从左边选一个故事开始审核。",
    tags: "标签",
    reports: "举报",
    times: "次",
    flags: "机器判定",
    appealNote: "作者申诉说明",
    flagNames: { privacy: "隐私泄露", attack: "攻击性表达", distress: "创伤 / 危险内容" } as Record<string, string>,
    keep: "保留这个故事",
    remove: "下架并通知作者",
    removeReason: "下架理由（会原样发给作者）",
    removePlaceholder: "例如：故事中包含他人可识别的真实信息，请匿名后重新发布。",
    needReason: "请先写下架理由，作者需要知道原因。",
    doneKeep: "已保留，星点继续留在星图里。",
    doneRemove: "已下架，那颗星已从星图移除，通知已发送。",
    handled: "本次已处理",
    reset: "重置演示数据",
    deskAll: "全部",
    deskPending: "待审核",
    deskReviewing: "审核中",
    deskPendingHint: "还没人打开过",
    deskReviewingHint: "已经打开过",
  },
  en: {
    title: "Moderation desk",
    lead: "Only stories that need a human call. Once you decide, the author is notified.",
    logout: "Leave admin",
    buckets: {
      reported: "Reported by users",
      uncertain: "System unsure",
      appealed: "Flagged in error",
    } as Record<ReviewBucket, string>,
    bucketHints: {
      reported: "Someone hit report",
      uncertain: "Machine unsure; author submitted anyway",
      appealed: "Author says the machine got it wrong",
    } as Record<ReviewBucket, string>,
    all: "All pending",
    empty: "Nothing pending in this bucket.",
    pickOne: "Pick a story on the left to start reviewing.",
    tags: "Tags",
    reports: "Reports",
    times: "×",
    flags: "Machine flags",
    appealNote: "Author's appeal",
    flagNames: { privacy: "Privacy leak", attack: "Hostile wording", distress: "Distress / danger" } as Record<string, string>,
    keep: "Keep this story",
    remove: "Remove & notify author",
    removeReason: "Reason for removal (sent to the author verbatim)",
    removePlaceholder: "e.g. The story contains identifying details about someone else — please anonymise and repost.",
    needReason: "Write a reason first — the author needs to know why.",
    doneKeep: "Kept. The star stays in the sky.",
    doneRemove: "Removed. That star is gone from the map and the author has been told.",
    handled: "Handled this session",
    reset: "Reset demo data",
    deskAll: "All",
    deskPending: "Not opened",
    deskReviewing: "In review",
    deskPendingHint: "nobody has opened it",
    deskReviewingHint: "already opened",
  },
} as const;

const BUCKETS: ReviewBucket[] = ["reported", "uncertain", "appealed"];

export function AdminConsole({
  language,
  themeMode,
  queue,
  onDecide,
  onOpen,
  onLogout,
  onResetDemo,
  onLanguageChange,
  onThemeModeChange,
}: {
  language: "zh" | "en";
  themeMode: ThemeMode;
  queue: ReviewItem[];
  onDecide: (item: ReviewItem, keep: boolean, reason: string, message: InboxMessage) => void;
  onOpen: (item: ReviewItem) => void;
  onLogout: () => void;
  onResetDemo: () => void;
  onLanguageChange: (language: "zh" | "en") => void;
  onThemeModeChange: (theme: ThemeMode) => void;
}) {
  const t = copy[language];
  const [bucket, setBucket] = useState<ReviewBucket | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [desk, setDesk] = useState<"all" | "pending" | "reviewing">("all");

  const pending = useMemo(() => queue.filter(item => item.status === "pending"), [queue]);
  const counts = useMemo(() => {
    const base: Record<string, { total: number; pending: number; reviewing: number }> = {
      all: { total: pending.length, pending: pending.filter(i => !i.opened).length, reviewing: pending.filter(i => i.opened).length },
    };
    BUCKETS.forEach(b => {
      const inBucket = pending.filter(item => item.bucket === b);
      base[b] = { total: inBucket.length, pending: inBucket.filter(i => !i.opened).length, reviewing: inBucket.filter(i => i.opened).length };
    });
    return base;
  }, [pending]);

  const byBucket = bucket === "all" ? pending : pending.filter(item => item.bucket === bucket);
  const list = desk === "all" ? byBucket : byBucket.filter(item => (desk === "reviewing" ? !!item.opened : !item.opened));
  const selected = pending.find(item => item.id === selectedId) ?? null;
  const handled = queue.length - pending.length;

  const decide = (keep: boolean) => {
    if (!selected) return;
    if (!keep && !reason.trim()) { setReasonError(true); return; }
    const message: InboxMessage = {
      id: `msg-${selected.id}`,
      status: "resolved",
      kind: keep ? "kept" : "removed",
      storyTitle: selected.title,
      reason: keep ? "" : reason.trim(),
      createdAt: Date.now(),
      read: false,
    };
    onDecide(selected, keep, reason.trim(), message);
    setToast(keep ? t.doneKeep : t.doneRemove);
    setSelectedId(null);
    setReason("");
    setReasonError(false);
    window.setTimeout(() => setToast(""), 3200);
  };

  return (
    <main className={`admin-page ${themeMode === "night" ? "theme-night admin-universe" : "admin-sky"}`}>
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-logo">Story<b>Verse</b></span>
          <span className="admin-badge">ADMIN</span>
        </div>
        <div className="admin-header-actions">
          <button className="admin-ghost" onClick={() => onThemeModeChange(themeMode === "night" ? "day" : "night")}>
            {themeMode === "night" ? "☀" : "☾"}
          </button>
          <button className="admin-ghost" onClick={() => onLanguageChange(language === "zh" ? "en" : "zh")}>
            {language === "zh" ? "中文 / ENG" : "ENG / 中文"}
          </button>
          <button className="admin-ghost" onClick={onResetDemo}>{t.reset}</button>
          <button className="admin-ghost danger" onClick={onLogout}>{t.logout}</button>
        </div>
      </header>

      <section className="admin-intro">
        <h1>{t.title}</h1>
        <p>{t.lead}</p>
      </section>

      <section className="admin-stats">
        <button className={`admin-stat ${bucket === "all" ? "is-active" : ""}`} onClick={() => { setBucket("all"); setSelectedId(null); }}>
          <b>{counts.all.total}</b><span>{t.all}</span><small>{t.deskPending} {counts.all.pending} · {t.deskReviewing} {counts.all.reviewing}</small>
        </button>
        {BUCKETS.map(b => (
          <button key={b} className={`admin-stat bucket-${b} ${bucket === b ? "is-active" : ""}`} onClick={() => { setBucket(b); setSelectedId(null); }}>
            <b>{counts[b].total}</b><span>{t.buckets[b]}</span><small>{t.deskPending} {counts[b].pending} · {t.deskReviewing} {counts[b].reviewing}</small>
          </button>
        ))}
      </section>

      <section className="admin-body">
        <div className="admin-list">
          <div className="desk-filter">
            {(["all", "pending", "reviewing"] as const).map(key => (
              <button key={key} className={desk === key ? "is-active" : ""} onClick={() => { setDesk(key); setSelectedId(null); }}>
                {key === "all" ? t.deskAll : key === "pending" ? t.deskPending : t.deskReviewing}
                <i>{key === "all" ? counts[bucket === "all" ? "all" : bucket].total
                  : key === "pending" ? counts[bucket === "all" ? "all" : bucket].pending
                  : counts[bucket === "all" ? "all" : bucket].reviewing}</i>
              </button>
            ))}
          </div>
          {list.length === 0 && <p className="admin-empty">{t.empty}</p>}
          {list.map(item => (
            <button
              key={item.id}
              className={`admin-row ${selectedId === item.id ? "is-selected" : ""}`}
              onClick={() => { setSelectedId(item.id); setReason(""); setReasonError(false); onOpen(item); }}
            >
              <span className="row-tags">
                <span className={`row-tag bucket-${item.bucket}`}>{t.buckets[item.bucket]}</span>
                <span className={`desk-tag ${item.opened ? "is-reviewing" : "is-pending"}`}>
                  {item.opened ? t.deskReviewing : t.deskPending}
                </span>
              </span>
              <b>{item.title}</b>
              <small>{item.author} · {item.city || "—"}</small>
              {item.reportCount ? <em className="row-count">{t.reports} {item.reportCount}{t.times}</em> : null}
            </button>
          ))}
        </div>

        <div className="admin-detail">
          {!selected && <p className="admin-empty">{t.pickOne}</p>}
          {selected && (
            <>
              <div className="detail-head">
                <span className="row-tags">
                  <span className={`row-tag bucket-${selected.bucket}`}>{t.buckets[selected.bucket]}</span>
                  <span className={`desk-tag ${selected.opened ? "is-reviewing" : "is-pending"}`}>
                    {selected.opened ? t.deskReviewing : t.deskPending}
                  </span>
                </span>
                <h2>{selected.title}</h2>
                <small>{selected.author} · {selected.city || "—"} · {new Date(selected.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}</small>
              </div>

              <article className="detail-body">{selected.body}</article>

              <div className="detail-meta">
                <div><span>{t.tags}</span><div className="detail-chips">{selected.tags.map(tag => <i key={tag}>{tag}</i>)}</div></div>
                {selected.flags?.length ? (
                  <div><span>{t.flags}</span><div className="detail-chips">{selected.flags.map(f => <i className="flag" key={f}>{t.flagNames[f] ?? f}</i>)}</div></div>
                ) : null}
                {selected.reportReasons?.length ? (
                  <div><span>{t.reports}</span><div className="detail-chips">{selected.reportReasons.map((r, i) => <i className="report" key={i}>{r}</i>)}</div></div>
                ) : null}
                {selected.appealNote ? (
                  <div><span>{t.appealNote}</span><p className="detail-appeal">{selected.appealNote}</p></div>
                ) : null}
              </div>

              <label className="detail-reason">
                <span>{t.removeReason}</span>
                <textarea
                  value={reason}
                  placeholder={t.removePlaceholder}
                  onChange={e => { setReason(e.target.value); setReasonError(false); }}
                />
                {reasonError && <em className="reason-error">{t.needReason}</em>}
              </label>

              <div className="detail-actions">
                <button className="admin-keep" onClick={() => decide(true)}>{t.keep}</button>
                <button className="admin-remove" onClick={() => decide(false)}>{t.remove}</button>
              </div>
            </>
          )}
        </div>
      </section>

      {toast && <div className="admin-toast">{toast}</div>}
    </main>
  );
}
