import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { dataService } from "../services/data-service";
import { initialState, loadState, saveState } from "../lib/app-state-storage";
import { clearRecoveryDraft, loadRecoveryDraft, saveRecoveryDraft } from "../lib/draft-recovery";
import {
  authenticatedEntryScreen,
  externalPath,
  guardPostPublishScreenForFirstStory,
  normalizedPath,
  pathFromState,
  routePatchFromPath,
} from "./routes";
import { Gateway } from "../features/gateway/Gateway";
import { StarLobby } from "../features/star-lobby/StarLobby";
import { AdminConsole } from "../features/admin/AdminConsole";
import { AdminGate } from "../features/admin/AdminGate";
import { StoryEditor } from "../features/story-editor/StoryEditor";
import { ResonancePage } from "../features/resonance/ResonancePage";
import { RecommendationsPage } from "../features/recommendations/RecommendationsPage";
import type { AppState, StoryDraft, Story, TourSceneId, UserProfile } from "../types/domain";
import type { AppUpdate, AuthMode, GatewayAuthInput, GatewaySection, ThemeMode } from "../types/ui";
import "../features/tour/tour.css";

export default function App() {
  const initialRoute = typeof window !== "undefined" ? routePatchFromPath() : {};
  const [state, setState] = useState<AppState>(() => {
    const loaded = { ...loadState(), ...initialRoute };
    /*
     * 加 ?tour=1 可以把新手引导重新打开一次，方便演示和回归验证。
     * 引导一旦看完或跳过就永久关闭，否则想再看一遍只能去清 localStorage。
     */
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("tour")) {
      return { ...loaded, tour: { enabled: true, seen: [] } };
    }
    return loaded;
  });
  const [gatewaySection, setGatewaySection] = useState<GatewaySection>(() => initialRoute.gatewaySection ?? "intro");
  const [authMode, setAuthMode] = useState<AuthMode>(() => initialRoute.authMode ?? "signup");
  const [themeMode, setThemeMode] = useState<ThemeMode>("day");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [localStories, setLocalStories] = useState<Story[]>([]);
  const [ownedStoryIds, setOwnedStoryIds] = useState<string[]>([]);
  const lastPathRef = useRef<string>(typeof window !== "undefined" ? normalizedPath() : "/");
  const poppingRef = useRef(false);
  const update: AppUpdate = (patch) =>
    setState((previous) => ({ ...previous, ...(typeof patch === "function" ? patch(previous) : patch) }));
  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    let active = true;
    dataService
      .getCurrentUser()
      .then(async ({ user: currentUser }) => {
        if (!active) return;
        setUser(currentUser);
        const [savedDraft, resonance, storyList, ownedStories, inbox, reactions] = await Promise.all([
          dataService.getCurrentDraft(),
          dataService.getResonancePreferences(),
          dataService.listLobbyStories().then((items) => items.map((item) => item.story)),
          dataService.listOwnedStories(),
          dataService.listNotifications(),
          dataService.listReactions(),
        ]);
        if (!active) return;
        setLocalStories(storyList);
        setOwnedStoryIds(ownedStories.map((story) => story.id));
        const hasSubmittedStory = ownedStories.some(
          (story) => story.status !== "draft" && story.status !== "analyzing" && story.status !== "needs_confirmation",
        );
        update((previous) => {
          const screen = guardPostPublishScreenForFirstStory(previous.screen, hasSubmittedStory);
          const wasRedirectedToFirstStory = screen !== previous.screen;
          return {
            screen,
            hasCompletedFirstStory: hasSubmittedStory,
            ...(savedDraft
              ? { draft: { ...initialState.draft, ...savedDraft } }
              : wasRedirectedToFirstStory
                ? {
                    draft: { ...initialState.draft, startedAt: Date.now() },
                    analysis: null,
                    storyEditorStep: 0,
                  }
                : {}),
            resonance,
            inbox,
            reactions,
            isAdmin: currentUser.role === "admin",
          };
        });
        setSessionChecked(true);
      })
      .catch(async () => {
        const recovery = await loadRecoveryDraft().catch(() => undefined);
        if (!active) return;
        update((previous) => ({
          ...(recovery?.body.trim() ? { draft: { ...initialState.draft, ...recovery } } : {}),
          ...(["resonance", "recommendations", "starLobby"].includes(previous.screen)
            ? { screen: "intro" as const }
            : {}),
        }));
        setSessionChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const draftContentKey = [
    state.draft.guide,
    state.draft.customGuide,
    state.draft.title,
    state.draft.body,
    state.draft.mood,
    state.draft.stage,
    state.draft.age,
    state.draft.gender,
    state.draft.city,
    state.draft.cityNameEn,
    state.draft.cityCountry,
    state.draft.cityLat,
    state.draft.cityLon,
    state.draft.people.join("|"),
  ].join("\u0000");
  useEffect(() => {
    if (!state.draft.title.trim() && !state.draft.body.trim()) return;
    void saveRecoveryDraft(state.draft);
    if (!user) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      dataService
        .saveDraft(state.draft)
        .then((saved) => {
          if (cancelled) return;
          update((previous) => ({
            draft: {
              ...previous.draft,
              id: saved.id,
              version: saved.version,
              savedAt: saved.savedAt,
              saves: saved.saves,
            },
          }));
          void clearRecoveryDraft();
        })
        .catch(() => undefined);
    }, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draftContentKey, user?.id]);
  useEffect(() => {
    const onPop = () => {
      const route = routePatchFromPath();
      poppingRef.current = true;
      if (route.gatewaySection) setGatewaySection(route.gatewaySection);
      if (route.authMode) setAuthMode(route.authMode);
      const { gatewaySection: _gatewaySection, authMode: _authMode, ...statePatch } = route;
      update(statePatch);
      lastPathRef.current = normalizedPath();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const path = pathFromState(state);
    if (path === lastPathRef.current) {
      poppingRef.current = false;
      return;
    }
    const method = poppingRef.current ? "replaceState" : "pushState";
    window.history[method]({}, "", externalPath(path));
    lastPathRef.current = path;
    poppingRef.current = false;
  }, [state.screen, state.storyEditorStep, gatewaySection, authMode]);
  const goHome = () => {
    setGatewaySection("intro");
    update({ screen: "intro" });
  };
  useEffect(() => {
    if (!sessionChecked) return;
    const guardedScreen = guardPostPublishScreenForFirstStory(state.screen, state.hasCompletedFirstStory);
    if (guardedScreen === state.screen) return;
    update({ screen: user ? guardedScreen : "intro" });
  }, [sessionChecked, state.screen, user?.id, state.hasCompletedFirstStory]);
  const enterStarLobby = () => {
    if (!user) {
      goHome();
      return;
    }
    if (!state.hasCompletedFirstStory) {
      update({ screen: "storyEditor" });
      return;
    }
    update({ screen: "starLobby" });
    void dataService
      .refreshRecommendations()
      .then(() => dataService.listLobbyStories())
      .then((items) => setLocalStories(items.map((item) => item.story)))
      .catch((error) => console.info("[StoryVerse] Recommendations could not be refreshed.", error));
  };
  const startNewStory = () =>
    update({
      screen: "storyEditor",
      storyEditorStep: 0,
      analysis: null,
      draft: { ...initialState.draft, startedAt: Date.now() },
    });
  const publishStory = async (draft: StoryDraft, analysis: NonNullable<AppState["analysis"]>) => {
    const result = await dataService.publishStory(draft, analysis);
    if (result.requiresConfirmation && result.analysis) {
      update({ analysis: result.analysis, storyEditorStep: 3 });
      return;
    }
    const story = result.story;
    if (result.status === "published") setLocalStories((previous) => [story, ...previous]);
    setOwnedStoryIds((previous) => [story.id, ...previous]);
    const inbox = await dataService.listNotifications().catch(() => state.inbox);
    await clearRecoveryDraft().catch(() => undefined);
    update({ hasCompletedFirstStory: true, screen: "resonance", inbox });
  };
  const completeAuth = async (input: GatewayAuthInput) => {
    let result: { user: UserProfile };
    let savedDraft: Awaited<ReturnType<typeof dataService.getCurrentDraft>> = null;
    let resonance: AppState["resonance"] = state.resonance;
    let storyList: Story[] = [];
    let ownedStories: Story[] = [];
    let inbox: AppState["inbox"] = [];
    let reactions: AppState["reactions"] = {};

    result =
      input.mode === "signup"
        ? await dataService.register({
            accountIdentifier: input.accountIdentifier,
            password: input.password,
            passwordConfirmation: input.passwordConfirmation,
            displayName: input.displayName,
            securityQuestion: input.securityQuestion,
            securityAnswer: input.securityAnswer,
          })
        : await dataService.login({ accountIdentifier: input.accountIdentifier, password: input.password });
    [savedDraft, resonance, storyList, ownedStories, inbox, reactions] = await Promise.all([
      dataService.getCurrentDraft(),
      dataService.getResonancePreferences(),
      dataService.listLobbyStories().then((items) => items.map((item) => item.story)),
      dataService.listOwnedStories(),
      dataService.listNotifications(),
      dataService.listReactions(),
    ]);

    setUser(result.user);
    setSessionChecked(true);
    setLocalStories(storyList);
    setOwnedStoryIds(ownedStories.map((story) => story.id));
    /*
     * 注册 ＝ 全新账号：重开新手引导，并强制回到第一步。
     * 不重置的话，浏览器里残留的 tour.enabled=false / hasCompletedFirstStory=true
     * 会让新注册的人看不到引导、或者直接掉进星空大厅 —— 而大厅按设计是最后一站。
     * 登录保持原逻辑（有本地草稿就续写）。
     */
    const signup = input.mode === "signup";
    const hasSubmittedStory = ownedStories.some(
      (story) => story.status !== "draft" && story.status !== "analyzing" && story.status !== "needs_confirmation",
    );
    const screen = authenticatedEntryScreen({
      isSignup: signup,
      hasSavedDraft: Boolean(savedDraft),
      hasPublishedStory: hasSubmittedStory,
    });
    const startsBlankFirstStory = screen === "storyEditor" && !savedDraft;
    update({
      screen,
      hasCompletedFirstStory: hasSubmittedStory,
      ...(savedDraft
        ? { draft: { ...initialState.draft, ...savedDraft } }
        : startsBlankFirstStory
          ? { draft: { ...initialState.draft, startedAt: Date.now() }, analysis: null, storyEditorStep: 0 }
          : {}),
      ...(signup ? { tour: { enabled: true, seen: [] }, analysis: null, storyEditorStep: 0 } : {}),
      resonance,
      inbox,
      reactions,
      isAdmin: result.user.role === "admin",
    });
  };

  /*
   * 新手引导的调度。每个场景只在「引导还开着」且「这个场景没播过」时出现，
   * 所以用户往回退一步不会被同一段引导再拦一次。
   *
   * 「跳过本页」只把当前场景标记成看过，后面的页面照常播 —— 在第一步嫌啰嗦
   * 而跳过，不该连带失去后面所有页面的引导。整条引导只在走完最后一站
   * （星空大厅）时才真正关闭。
   */
  const tourSeen = (scene: TourSceneId) => state.tour.seen.includes(scene);
  const tourActive = (scene: TourSceneId) => state.tour.enabled && !tourSeen(scene);
  const markSeen = (previous: AppState, scene: TourSceneId, done: boolean) => ({
    tour: {
      enabled: done ? false : previous.tour.enabled,
      seen: previous.tour.seen.includes(scene) ? previous.tour.seen : [...previous.tour.seen, scene],
    },
  });
  // 大厅是流程的最后一站，走完＝整条引导结束
  const finishTour = (scene: TourSceneId) => update((previous) => markSeen(previous, scene, scene === "starLobby"));
  const skipTour = (scene: TourSceneId) => update((previous) => markSeen(previous, scene, false));

  let content: ReactNode;
  if (state.screen === "admin") {
    content =
      state.isAdmin && user?.role === "admin" ? (
        <AdminConsole
          language={state.language}
          themeMode={themeMode}
          onLogout={() => {
            void dataService.logout().finally(() => {
              setUser(null);
              update({ isAdmin: false, inbox: [], reactions: {} });
            });
          }}
          onLanguageChange={(language) => update({ language })}
          onThemeModeChange={setThemeMode}
        />
      ) : (
        <AdminGate
          language={state.language}
          themeMode={themeMode}
          onBack={() => update({ screen: "intro" })}
          onSignedIn={() => {
            void dataService.getCurrentUser().then(({ user: adminUser }) => {
              setUser(adminUser);
              update({ isAdmin: adminUser.role === "admin" });
            });
          }}
          onThemeModeChange={setThemeMode}
        />
      );
  } else if (state.screen === "intro") {
    content = (
      <Gateway
        language={state.language}
        onLanguageChange={(language) => update({ language })}
        onHome={goHome}
        onComplete={completeAuth}
        onAdmin={() => update({ screen: "admin" })}
        section={gatewaySection}
        authMode={authMode}
        onAuthModeChange={setAuthMode}
        onSectionChange={setGatewaySection}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />
    );
  } else if (state.screen === "storyEditor")
    content = (
      <StoryEditor
        state={state}
        update={update}
        onPublished={publishStory}
        onHome={goHome}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        tourActive={tourActive}
        onTourFinish={finishTour}
        onTourSkip={skipTour}
      />
    );
  else if (state.screen === "resonance")
    content = (
      <ResonancePage
        state={state}
        update={update}
        onBack={() => update({ screen: "storyEditor", storyEditorStep: 3 })}
        onContinue={() => {
          void dataService
            .saveResonancePreferences(state.resonance)
            .catch((error) => console.info("[StoryVerse] Resonance could not be saved.", error));
          enterStarLobby();
        }}
        onHome={goHome}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        tourActive={tourActive}
        onTourFinish={finishTour}
        onTourSkip={skipTour}
      />
    );
  else if (state.screen === "recommendations")
    content = (
      <RecommendationsPage
        state={state}
        update={update}
        onEnterStarLobby={enterStarLobby}
        onHome={goHome}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />
    );
  else
    content = (
      <StarLobby
        language={state.language}
        themeMode={themeMode}
        onLanguageChange={(language) => update({ language })}
        onThemeModeChange={setThemeMode}
        onStartStory={startNewStory}
        onHome={goHome}
        onLogout={() => {
          void dataService.logout().finally(() => {
            setUser(null);
            setSessionChecked(true);
            setLocalStories([]);
            setOwnedStoryIds([]);
            setGatewaySection("intro");
            update({ screen: "intro", inbox: [], reactions: {}, isAdmin: false });
          });
        }}
        resonance={state.resonance}
        onResonanceChange={(resonance) => {
          update({ resonance });
          void dataService
            .saveResonancePreferences(resonance)
            .then(() => dataService.refreshRecommendations())
            .then(() => dataService.listLobbyStories())
            .then((items) => setLocalStories(items.map((item) => item.story)))
            .catch((error) => console.info("[StoryVerse] Resonance update could not refresh recommendations.", error));
        }}
        stories={localStories}
        ownedStoryIds={ownedStoryIds}
        reactions={state.reactions}
        onReactionChange={(storyId, reaction) => {
          update((previous) => ({ reactions: { ...previous.reactions, [storyId]: reaction } }));
          void (reaction ? dataService.setReaction(storyId, reaction) : dataService.clearReaction(storyId));
        }}
        onReportStory={(storyId, reason, note) => {
          return dataService.createReport(storyId, reason, note).then(() => undefined);
        }}
        showTour={tourActive("starLobby")}
        onTourFinish={() => finishTour("starLobby")}
        onTourSkip={() => skipTour("starLobby")}
        removedStoryIds={[]}
        inbox={state.inbox}
        onMarkInboxRead={() => {
          void dataService.markNotificationsRead();
          update((previous) => ({ inbox: previous.inbox.map((m) => ({ ...m, read: true })) }));
        }}
      />
    );

  return <>{content}</>;
}
