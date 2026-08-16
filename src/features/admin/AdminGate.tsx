import { useState } from "react";
import { dataService } from "../../services/data-service";
import type { Language } from "../../types/domain";
import type { ThemeMode } from "../../types/ui";

export function AdminGate({
  language,
  themeMode,
  onBack,
  onSignedIn,
  onThemeModeChange,
}: {
  language: Language;
  themeMode: ThemeMode;
  onBack: () => void;
  onSignedIn: () => void;
  onThemeModeChange: (theme: ThemeMode) => void;
}) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const zh = language === "zh";

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const result = await dataService.login({ accountIdentifier: user, password: pass });
      if (result.user.role !== "admin") {
        await dataService.logout();
        setError(zh ? "这个账号没有管理员权限。" : "This account is not an administrator.");
        return;
      }
      onSignedIn();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : zh ? "账号或密码不正确。" : "Incorrect username or password.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={`admin-gate ${themeMode === "night" ? "theme-night admin-universe" : "admin-sky"}`}>
      <div className="admin-gate-card">
        <button
          className="admin-gate-theme"
          aria-label={zh ? "切换主题" : "Switch theme"}
          onClick={() => onThemeModeChange(themeMode === "night" ? "day" : "night")}
        >
          {themeMode === "night" ? "☀" : "☾"}
        </button>
        <button className="admin-gate-back" onClick={onBack}>
          ← {zh ? "返回 StoryVerse" : "Back to StoryVerse"}
        </button>
        <h1>{zh ? "内容审核台" : "Moderation desk"}</h1>
        <p>
          {zh
            ? "仅供审核人员使用。登录后可以处理被举报、机器不确定与申诉的故事。"
            : "For reviewers only. Sign in to handle reported, uncertain and appealed stories."}
        </p>
        <label>
          <span>{zh ? "账号" : "Username"}</span>
          <input
            value={user}
            onChange={(event) => {
              setUser(event.target.value);
              setError("");
            }}
            autoComplete="username"
          />
        </label>
        <label>
          <span>{zh ? "密码" : "Password"}</span>
          <input
            type="password"
            value={pass}
            onChange={(event) => {
              setPass(event.target.value);
              setError("");
            }}
            autoComplete="current-password"
          />
        </label>
        {error && <em className="admin-gate-error">{error}</em>}
        <button className="admin-gate-submit" disabled={submitting} onClick={() => void submit()}>
          {submitting ? (zh ? "正在验证…" : "Checking…") : zh ? "进入审核台" : "Enter the desk"}
        </button>
      </div>
    </main>
  );
}
