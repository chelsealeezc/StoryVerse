import { useState } from "react";
import { Moon, ShieldCheck, Sun } from "lucide-react";
import { localizedError } from "../../lib/localized-error";
import { dataService } from "../../services/data-service";
import type { Language } from "../../types/domain";
import type { ThemeMode } from "../../types/ui";
import "./admin.css";

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
      setError(localizedError(reason, language, { zh: "账号或密码不正确。", en: "Incorrect username or password." }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={`admin-gate ${themeMode === "night" ? "theme-night" : ""}`}>
      <div className="admin-gate-card">
        <button
          className="admin-gate-theme"
          aria-label={zh ? "切换主题" : "Switch theme"}
          onClick={() => onThemeModeChange(themeMode === "night" ? "day" : "night")}
        >
          {themeMode === "night" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <section className="admin-gate-intro">
          <div className="admin-gate-brand">
            <span>SV</span>
            <b>StoryVerse</b>
          </div>
          <div>
            <h2>{zh ? "让每一次管理判断都有据可循。" : "Make every operational decision traceable."}</h2>
            <p>
              {zh
                ? "审核、内容、账号、AI 任务和冷启动数据集中在一个内部工作台中。"
                : "Reviews, content, accounts, AI tasks and seed data live in one internal workspace."}
            </p>
          </div>
          <div className="admin-gate-security">
            <ShieldCheck size={16} />
            <span>{zh ? "管理员角色由服务端验证" : "Admin role verified server-side"}</span>
          </div>
        </section>
        <section className="admin-gate-form">
          <button className="admin-gate-back" onClick={onBack}>
            ← {zh ? "返回 StoryVerse" : "Back to StoryVerse"}
          </button>
          <h1>{zh ? "运营管理台" : "Operations console"}</h1>
          <p>
            {zh
              ? "使用已被授予管理员角色的普通账号登录。"
              : "Sign in with an account that has been granted the administrator role."}
          </p>
          <label>
            <span>{zh ? "管理员账号" : "Administrator username"}</span>
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
            {submitting ? (zh ? "正在验证…" : "Checking…") : zh ? "进入管理台" : "Open console"}
          </button>
        </section>
      </div>
    </main>
  );
}
