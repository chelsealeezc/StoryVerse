import { useEffect, useMemo, useState } from "react";
import { dataService, type AdminDashboard } from "../../services/data-service";
import type { Language, ModerationFlag, ReviewBucket, ReviewItem } from "../../types/domain";
import type { ThemeMode } from "../../types/ui";
import "./admin.css";

type AdminView = "reviews" | "accounts" | "stories" | "types" | "tasks" | "feedback" | "algorithm" | "imports";

const viewLabels: Record<AdminView, [string, string]> = {
  reviews: ["人工审核", "Reviews"],
  accounts: ["账号", "Accounts"],
  stories: ["故事", "Stories"],
  types: ["类型与颜色", "Types"],
  tasks: ["AI 任务", "AI tasks"],
  feedback: ["用户反馈", "Feedback"],
  algorithm: ["推荐权重", "Algorithm"],
  imports: ["冷启动导入", "Seed import"],
};

const emptyDashboard: AdminDashboard = {
  reviews: [],
  users: [],
  stories: [],
  tasks: [],
  feedback: [],
  types: [],
  configs: [],
  imports: [],
  failures: [],
};

function rowObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function reviewFromRow(row: Record<string, unknown>): ReviewItem {
  const story = rowObject(row.story);
  const author = rowObject(row.author);
  const reports = Array.isArray(row.reports) ? row.reports.map(rowObject) : [];
  const source = String(row.source ?? "moderation");
  const status = String(row.status ?? "pending");
  return {
    id: String(row.id),
    storyId: String(row.story_id ?? story.id ?? ""),
    title: String(story.title || story.ai_suggested_title || "未命名故事"),
    body: String(story.body ?? ""),
    tags: [
      ...(Array.isArray(story.final_themes) ? story.final_themes.map(String) : []),
      String(story.final_type_id || story.ai_type_id || ""),
    ].filter(Boolean),
    author: String(author.display_name || author.username || "匿名作者"),
    city: String(story.city ?? ""),
    createdAt: new Date(String(row.created_at)).getTime(),
    bucket: (source === "report" ? "reported" : source === "appeal" ? "appealed" : "uncertain") as ReviewBucket,
    status: status === "approved" ? "kept" : status === "needs_edit" ? "removed" : "pending",
    reportCount: reports.length,
    reportReasons: reports.map((report) => [report.reason, report.note].filter(Boolean).join("：")),
    flags: (Array.isArray(row.categories) ? row.categories.map(String) : []) as ModerationFlag[],
    appealNote: row.appeal_note ? String(row.appeal_note) : undefined,
    removalReason: row.decision_reason ? String(row.decision_reason) : undefined,
    hasBeenOpened: Boolean(row.has_been_opened) || status === "reviewing",
  };
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  const headers = (rows.shift() ?? []).map((header) => header.trim());
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])),
  );
}

export function AdminConsole({
  language,
  themeMode,
  onLogout,
  onLanguageChange,
  onThemeModeChange,
}: {
  language: Language;
  themeMode: ThemeMode;
  onLogout: () => void;
  onLanguageChange: (language: Language) => void;
  onThemeModeChange: (theme: ThemeMode) => void;
}) {
  const zh = language === "zh";
  const [view, setView] = useState<AdminView>("reviews");
  const [dashboard, setDashboard] = useState<AdminDashboard>(emptyDashboard);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<Record<string, number>>({
    city: 0.15,
    life: 0.25,
    theme: 0.25,
    semantic: 0.35,
    age: 0.5,
    stage: 0.3,
    gender: 0.2,
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await dataService.getAdminDashboard();
      setDashboard(next);
      const savedWeights = rowObject(rowObject(next.configs[0]).weights);
      if (Object.keys(savedWeights).length) {
        setWeights((current) =>
          Object.fromEntries(Object.keys(current).map((key) => [key, Number(savedWeights[key] ?? current[key])])),
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : zh ? "无法读取后台数据。" : "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const run = async (task: () => Promise<unknown>, success: string) => {
    setError("");
    try {
      await task();
      if (success) setNotice(success);
      await load();
      if (success) window.setTimeout(() => setNotice(""), 2600);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : zh ? "操作失败。" : "Action failed.");
      return false;
    }
  };

  const reviews = useMemo(
    () => dashboard.reviews.map(reviewFromRow).filter((review) => review.status === "pending"),
    [dashboard.reviews],
  );
  const selected = reviews.find((review) => review.id === selectedId) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (values: unknown[]) =>
    !normalizedQuery ||
    values.some((value) =>
      String(value ?? "")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );

  const openReview = (review: ReviewItem) => {
    setSelectedId(review.id);
    setReason("");
    if (!review.hasBeenOpened) void run(() => dataService.adminAction("review-open", { reviewId: review.id }), "");
  };

  const decide = (decision: "approved" | "needs_edit") => {
    if (!selected) return;
    if (decision === "needs_edit" && !reason.trim()) {
      setError(zh ? "请先填写需要修改的原因。" : "Please provide a reason.");
      return;
    }
    void run(
      () => dataService.adminAction("review-decide", { reviewId: selected.id, decision, reason: reason.trim() }),
      decision === "approved"
        ? zh
          ? "故事已允许公开。"
          : "Story approved."
        : zh
          ? "已通知作者修改。"
          : "Author notified.",
    ).then((completed) => completed && setSelectedId(null));
  };

  const importCsv = async (file: File) => {
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error(zh ? "CSV 中没有可导入的数据。" : "The CSV contains no data rows.");
    await dataService.adminAction("seed-import", { filename: file.name, rows });
  };

  return (
    <main className={`admin-page ${themeMode === "night" ? "theme-night admin-universe" : "admin-sky"}`}>
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-logo">
            Story<b>Verse</b>
          </span>
          <span className="admin-badge">ADMIN</span>
        </div>
        <div className="admin-header-actions">
          <button className="admin-ghost" onClick={() => void load()}>
            {zh ? "刷新" : "Refresh"}
          </button>
          <button className="admin-ghost" onClick={() => onThemeModeChange(themeMode === "night" ? "day" : "night")}>
            {themeMode === "night" ? "☀" : "☾"}
          </button>
          <button className="admin-ghost" onClick={() => onLanguageChange(zh ? "en" : "zh")}>
            {zh ? "中文 / ENG" : "ENG / 中文"}
          </button>
          <button className="admin-ghost danger" onClick={onLogout}>
            {zh ? "退出管理端" : "Log out"}
          </button>
        </div>
      </header>

      <section className="admin-intro">
        <h1>{zh ? "StoryVerse 管理后台" : "StoryVerse Admin"}</h1>
        <p>
          {zh
            ? "账号、故事、审核、类型、AI 任务和推荐配置均由服务端权限保护。"
            : "Server-protected account, story, review, AI and recommendation management."}
        </p>
      </section>

      <nav className="admin-tabs" aria-label={zh ? "后台功能" : "Admin sections"}>
        {(Object.keys(viewLabels) as AdminView[]).map((key) => (
          <button
            key={key}
            className={view === key ? "is-active" : ""}
            onClick={() => {
              setView(key);
              setSelectedId(null);
              setQuery("");
            }}
          >
            {viewLabels[key][zh ? 0 : 1]}
            {key === "reviews" && <i>{reviews.length}</i>}
          </button>
        ))}
      </nav>

      {error && <p className="admin-inline-error">{error}</p>}
      {loading && <p className="admin-loading">{zh ? "正在读取数据…" : "Loading…"}</p>}

      {view === "reviews" && !loading && (
        <section className="admin-body">
          <div className="admin-list">
            {!reviews.length && (
              <p className="admin-empty">{zh ? "暂无待人工审核的故事。" : "No stories need review."}</p>
            )}
            {reviews.map((review) => (
              <button
                key={review.id}
                className={`admin-row ${selectedId === review.id ? "is-selected" : ""}`}
                onClick={() => openReview(review)}
              >
                <span className="row-tags">
                  <span className={`row-tag bucket-${review.bucket}`}>{review.bucket}</span>
                </span>
                <b>{review.title}</b>
                <small>
                  {review.author} · {review.city || "—"}
                </small>
              </button>
            ))}
          </div>
          <div className="admin-detail">
            {!selected ? (
              <p className="admin-empty">{zh ? "从左侧选择一条故事。" : "Choose a story on the left."}</p>
            ) : (
              <>
                <div className="detail-head">
                  <h2>{selected.title}</h2>
                  <small>
                    {selected.author} · {selected.city || "—"}
                  </small>
                </div>
                <article className="detail-body">{selected.body}</article>
                <div className="detail-meta">
                  {!!selected.flags?.length && (
                    <div>
                      <span>{zh ? "机审关注项" : "Machine flags"}</span>
                      <div className="detail-chips">
                        {selected.flags.map((flag) => (
                          <i className="flag" key={flag}>
                            {flag}
                          </i>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!selected.reportReasons?.length && (
                    <div>
                      <span>{zh ? "举报说明" : "Reports"}</span>
                      <div className="detail-chips">
                        {selected.reportReasons.map((item, index) => (
                          <i className="report" key={index}>
                            {item}
                          </i>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <label className="detail-reason">
                  <span>{zh ? "需要修改的原因" : "Reason for revision"}</span>
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <div className="detail-actions">
                  <button className="admin-keep" onClick={() => decide("approved")}>
                    {zh ? "允许公开" : "Approve"}
                  </button>
                  <button className="admin-remove" onClick={() => decide("needs_edit")}>
                    {zh ? "需要修改" : "Needs changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {view !== "reviews" && !loading && (
        <section className="admin-management">
          {!(["types", "algorithm", "imports"] as AdminView[]).includes(view) && (
            <input
              className="admin-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={zh ? "搜索…" : "Search…"}
            />
          )}

          {view === "accounts" &&
            dashboard.users
              .filter((row) => matches([row.username, row.display_name]))
              .map((row) => (
                <article className="admin-management-row" key={String(row.id)}>
                  <div>
                    <b>{String(row.display_name)}</b>
                    <span>
                      @{String(row.username)} · {String(row.role)} · {String(row.status)}
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={() =>
                        void run(
                          () =>
                            dataService.adminAction("account-status", {
                              profileId: row.id,
                              status: row.status === "active" ? "suspended" : "active",
                            }),
                          zh ? "账号状态已更新。" : "Account updated.",
                        )
                      }
                    >
                      {row.status === "active" ? (zh ? "停用" : "Suspend") : zh ? "恢复" : "Restore"}
                    </button>
                    <button
                      onClick={() => {
                        const password = window.prompt(
                          zh ? "输入 10–72 位临时密码" : "Enter a 10–72 character temporary password",
                        );
                        if (password)
                          void run(
                            () => dataService.adminAction("account-reset-password", { profileId: row.id, password }),
                            zh ? "密码已重置。" : "Password reset.",
                          );
                      }}
                    >
                      {zh ? "重置密码" : "Reset password"}
                    </button>
                  </div>
                </article>
              ))}

          {view === "stories" &&
            dashboard.stories
              .filter((row) => matches([row.title, row.body, row.city]))
              .map((row) => (
                <article className="admin-management-row" key={String(row.id)}>
                  <div>
                    <b>{String(row.title || row.ai_suggested_title || "未命名故事")}</b>
                    <span>
                      {String(row.city)} · {String(row.status)} · {String(row.source_kind)}
                    </span>
                    <small>{String(row.body).slice(0, 120)}</small>
                  </div>
                  <div>
                    {row.source_kind === "seed" && (
                      <button
                        onClick={() => {
                          const title = window.prompt(zh ? "修改标题" : "Edit title", String(row.title ?? ""));
                          if (title === null) return;
                          const body = window.prompt(
                            zh ? "修改正文（100–1500 字）" : "Edit body (100–1500 characters)",
                            String(row.body ?? ""),
                          );
                          if (body === null) return;
                          void run(
                            () => dataService.adminAction("seed-update", { storyId: row.id, title, body }),
                            zh ? "冷启动故事已保存并重新入队。" : "Seed story saved and requeued.",
                          );
                        }}
                      >
                        {zh ? "编辑种子故事" : "Edit seed"}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const restoring = row.status === "removed";
                        const removalReason = restoring
                          ? ""
                          : window.prompt(zh ? "填写下架原因（会通知作者）" : "Removal reason sent to the author");
                        if (!restoring && !removalReason?.trim()) return;
                        void run(
                          () =>
                            dataService.adminAction("story-status", {
                              storyId: row.id,
                              status: restoring ? "published" : "removed",
                              reason: removalReason?.trim() ?? "",
                            }),
                          zh ? "故事状态已更新。" : "Story updated.",
                        );
                      }}
                    >
                      {row.status === "removed" ? (zh ? "恢复公开" : "Restore") : zh ? "下架" : "Remove"}
                    </button>
                  </div>
                </article>
              ))}

          {view === "types" &&
            dashboard.types.map((row, index) => (
              <article className="admin-management-row" key={String(row.id)}>
                <div>
                  <b>
                    {String(row.label_zh)} / {String(row.label_en)}
                  </b>
                  <span>
                    {String(row.id)} · #{String(row.sort_order)}
                  </span>
                </div>
                <div>
                  <button
                    disabled={index === 0}
                    onClick={() => {
                      const ids = dashboard.types.map((type) => String(type.id));
                      [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                      void run(
                        () => dataService.adminAction("types-reorder", { orderedIds: ids }),
                        zh ? "类型顺序已保存。" : "Order saved.",
                      );
                    }}
                  >
                    ↑
                  </button>
                  <button
                    disabled={index === dashboard.types.length - 1}
                    onClick={() => {
                      const ids = dashboard.types.map((type) => String(type.id));
                      [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
                      void run(
                        () => dataService.adminAction("types-reorder", { orderedIds: ids }),
                        zh ? "类型顺序已保存。" : "Order saved.",
                      );
                    }}
                  >
                    ↓
                  </button>
                  <input
                    type="color"
                    defaultValue={String(row.color)}
                    onBlur={(event) =>
                      void run(
                        () =>
                          dataService.adminAction("type-update", { typeId: row.id, color: event.currentTarget.value }),
                        zh ? "类型颜色已保存。" : "Color saved.",
                      )
                    }
                  />
                  <button
                    onClick={() =>
                      void run(
                        () => dataService.adminAction("type-update", { typeId: row.id, enabled: !row.enabled }),
                        zh ? "类型状态已保存。" : "Type updated.",
                      )
                    }
                  >
                    {row.enabled ? (zh ? "停用" : "Disable") : zh ? "启用" : "Enable"}
                  </button>
                </div>
              </article>
            ))}

          {view === "tasks" &&
            dashboard.tasks
              .filter((row) => matches([row.task_type, row.status, row.last_error]))
              .map((row) => (
                <article className="admin-management-row" key={String(row.id)}>
                  <div>
                    <b>
                      {String(row.task_type)} · {String(row.status)}
                    </b>
                    <span>{String(row.story_id ?? "")}</span>
                    <small>{String(row.last_error ?? "")}</small>
                  </div>
                  {row.status === "failed" && (
                    <button
                      onClick={() =>
                        void run(
                          () => dataService.adminAction("task-retry", { taskId: row.id }),
                          zh ? "已重新执行任务。" : "Task retried.",
                        )
                      }
                    >
                      {zh ? "重试" : "Retry"}
                    </button>
                  )}
                </article>
              ))}

          {view === "feedback" &&
            dashboard.feedback
              .filter((row) => matches([row.text, row.category]))
              .map((row) => {
                const profile = rowObject(row.profile);
                return (
                  <article className="admin-management-row" key={String(row.id)}>
                    <div>
                      <b>{String(profile.display_name || profile.username || "匿名用户")}</b>
                      <span>{String(row.category)}</span>
                      <small>{String(row.text)}</small>
                    </div>
                  </article>
                );
              })}

          {view === "algorithm" && (
            <article className="admin-config-card">
              <h2>{zh ? "保存并发布推荐公式版本" : "Save and publish recommendation weights"}</h2>
              <p>
                {zh
                  ? "总分四项与人生分三项都必须分别加总为 1。先保存草稿，再单独发布；旧批次继续引用旧版本。"
                  : "Both score groups must each sum to 1. Save a draft, then publish it; old batches retain their version."}
              </p>
              <div className="admin-weight-grid">
                {Object.entries(weights).map(([key, value]) => (
                  <label key={key}>
                    <span>{key}</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={value}
                      onChange={(event) => setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))}
                    />
                  </label>
                ))}
              </div>
              <div className="detail-actions">
                <button
                  className="admin-keep"
                  onClick={() =>
                    void run(
                      () => dataService.adminAction("config-save-draft", { weights }),
                      zh ? "推荐配置草稿已保存。" : "Draft saved.",
                    )
                  }
                >
                  {zh ? "保存草稿" : "Save draft"}
                </button>
                <button
                  className="admin-keep"
                  disabled={String(dashboard.configs[0]?.status) !== "draft"}
                  onClick={() =>
                    void run(
                      () => dataService.adminAction("config-publish", { configId: dashboard.configs[0]?.id }),
                      zh ? "新的权重版本已发布。" : "New weights published.",
                    )
                  }
                >
                  {zh ? "发布最新草稿" : "Publish latest draft"}
                </button>
              </div>
            </article>
          )}

          {view === "imports" && (
            <article className="admin-config-card">
              <h2>{zh ? "导入已授权的冷启动故事" : "Import authorised seed stories"}</h2>
              <p>
                {zh
                  ? "CSV 必须包含约定字段。external_id 防止重复导入；跳过安全审核时必须填写来源说明。"
                  : "Use the documented columns. external_id prevents duplicates; skipped moderation requires a source note."}
              </p>
              <label className="admin-file">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void run(() => importCsv(file), zh ? "CSV 已进入处理队列。" : "CSV queued.");
                  }}
                />
                {zh ? "选择 CSV 文件" : "Choose CSV"}
              </label>
              {dashboard.imports.map((row) => (
                <div className="admin-management-row" key={String(row.id)}>
                  <div>
                    <b>{String(row.filename)}</b>
                    <span>
                      {String(row.status)} · {String(row.imported_rows)}/{String(row.total_rows)} ·{" "}
                      {zh ? "失败" : "failed"} {String(row.failed_rows)}
                    </span>
                  </div>
                </div>
              ))}
              {!!dashboard.failures.length && <h3>{zh ? "待修复的失败行" : "Failed rows"}</h3>}
              {dashboard.failures.map((row) => (
                <div className="admin-management-row" key={String(row.id)}>
                  <div>
                    <b>
                      #{String(row.row_number)} · {String(row.external_id || "—")}
                    </b>
                    <span>{String(row.error)}</span>
                    <small>{JSON.stringify(row.raw_data)}</small>
                  </div>
                  <button
                    onClick={() => {
                      const edited = window.prompt(
                        zh ? "修改这一行的 JSON 后重试" : "Edit this row JSON before retrying",
                        JSON.stringify(row.raw_data),
                      );
                      if (!edited) return;
                      try {
                        const repaired = JSON.parse(edited) as Record<string, unknown>;
                        void run(
                          () =>
                            dataService.adminAction("seed-import", {
                              filename: `retry-${String(row.external_id || row.id)}.csv`,
                              rows: [repaired],
                              failureId: row.id,
                            }),
                          zh ? "该行已重新入队。" : "Row retried.",
                        );
                      } catch {
                        setError(zh ? "JSON 格式不正确。" : "Invalid JSON.");
                      }
                    }}
                  >
                    {zh ? "修复后重试" : "Edit & retry"}
                  </button>
                </div>
              ))}
            </article>
          )}
        </section>
      )}

      {notice && <div className="admin-toast">{notice}</div>}
    </main>
  );
}
