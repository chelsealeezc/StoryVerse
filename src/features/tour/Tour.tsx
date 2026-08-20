import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getScene, tourCopy } from "./tour-content";
import type { Placement } from "./tour-content";
import type { Language, TourSceneId } from "../../types/domain";
import { track } from "../../lib/analytics";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_W = 340;
const GAP = 16;
const EDGE = 14;

/**
 * 页面新手引导浮层。
 *
 * 高亮用的是「一个定位到目标上的空盒子 + 超大 box-shadow」，
 * 这样挖洞不需要 SVG mask，也不会拦住 GPU 合成。
 * 浮层本身吃掉所有点击，用户只能通过按钮推进 —— 免得引导中途把页面点乱。
 */
export function Tour({
  scene,
  language,
  onFinish,
  onSkip,
}: {
  scene: TourSceneId;
  language: Language;
  onFinish: (scene: TourSceneId) => void;
  /** 只跳过当前场景，后面的页面照常播放 —— 所以要把 scene 传回去 */
  onSkip: (scene: TourSceneId) => void;
}) {
  const config = getScene(scene);
  const ui = tourCopy[language];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(200);

  const step = config.steps[index];
  const last = index === config.steps.length - 1;

  // 场景切换时回到第一步
  useEffect(() => {
    setIndex(0);
    track("tour_started", { scene, step_count: config.steps.length });
  }, [scene]);
  useEffect(() => {
    if (!step) return;
    track("tour_step_viewed", { scene, step_index: index, step_number: index + 1, step_count: config.steps.length });
  }, [scene, index, step]);

  const measure = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return;
    }
    const pad = step.pad ?? 8;
    setRect({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }, [step]);

  /*
   * 同步量一次，别放进 requestAnimationFrame —— StrictMode 下 effect 会跑两遍，
   * 第一遍的清理会把排好的 rAF 取消掉，首次高亮就永远画不出来。
   * 目标可能还没渲染出来（比如懒加载的区块），所以留了重试。
   */
  useLayoutEffect(() => {
    if (!step) return;
    let cancelled = false;
    let timer = 0;

    const attempt = (tries: number) => {
      if (cancelled) return;
      if (!step.target) {
        setRect(null);
        return;
      }
      const el = document.querySelector(step.target);
      if (!el) {
        if (tries < 30) timer = window.setTimeout(() => attempt(tries + 1), 50);
        else setRect(null);
        return;
      }
      // 只有目标不在视野里才滚动，免得 fixed 元素被反复触发平滑滚动
      const r = el.getBoundingClientRect();
      const offscreen = r.top < 0 || r.bottom > window.innerHeight;
      if (offscreen) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        timer = window.setTimeout(() => {
          if (!cancelled) measure();
        }, 420);
      }
      measure();
    };

    attempt(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [step, measure]);

  useEffect(() => {
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [measure]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [index, language, rect]);

  const next = useCallback(() => {
    track("tour_next_clicked", { scene, step_index: index, is_last: last });
    if (last) {
      track("tour_completed", { scene, step_count: config.steps.length });
      onFinish(scene);
    } else setIndex((i) => i + 1);
  }, [last, onFinish, scene, index, config.steps.length]);

  const back = useCallback(() => {
    track("tour_back_clicked", { scene, step_index: index });
    setIndex((i) => Math.max(0, i - 1));
  }, [scene, index]);

  const skip = useCallback(() => {
    track("tour_skipped", { scene, step_index: index, step_count: config.steps.length });
    onSkip(scene);
  }, [scene, index, config.steps.length, onSkip]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        skip();
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, skip]);

  if (!step) return null;

  const copy = step[language];
  const placement: Placement = step.placement ?? "bottom";
  const centered = placement === "center" || !rect;

  // 气泡定位：先按指定方向放，放不下就翻到对面，最后再夹回视口内
  let cardStyle: React.CSSProperties;
  if (centered) {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  } else {
    const r = rect!;
    let top: number;
    let left: number;
    if (placement === "top" || placement === "bottom") {
      const above = r.top - GAP - cardH;
      const below = r.top + r.height + GAP;
      top =
        placement === "top"
          ? above >= EDGE
            ? above
            : below
          : below + cardH <= window.innerHeight - EDGE
            ? below
            : Math.max(EDGE, above);
      left = r.left + r.width / 2 - CARD_W / 2;
    } else {
      const leftPos = r.left - GAP - CARD_W;
      const rightPos = r.left + r.width + GAP;
      left =
        placement === "left"
          ? leftPos >= EDGE
            ? leftPos
            : rightPos
          : rightPos + CARD_W <= window.innerWidth - EDGE
            ? rightPos
            : Math.max(EDGE, leftPos);
      top = r.top + r.height / 2 - cardH / 2;
    }
    left = Math.min(Math.max(EDGE, left), window.innerWidth - CARD_W - EDGE);
    top = Math.min(Math.max(EDGE, top), Math.max(EDGE, window.innerHeight - cardH - EDGE));
    cardStyle = { top, left };
  }

  const finishLabel = config.finishLabel ? config.finishLabel[language] : ui.done;

  return (
    <div
      className={`tour-layer ${step.interactive ? "is-interactive" : ""}`}
      role="dialog"
      aria-modal={step.interactive ? undefined : true}
      aria-label={copy.title}
    >
      {rect && !centered ? (
        <div
          className="tour-spotlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : (
        <div className="tour-scrim" />
      )}

      <div className="tour-card" ref={cardRef} style={cardStyle}>
        <div className="tour-card-head">
          <span className="tour-count">
            {index + 1} {ui.of} {config.steps.length}
          </span>
          <button className="tour-skip" onClick={skip}>
            {ui.skip}
          </button>
        </div>
        <h3>{copy.title}</h3>
        {copy.body.split("\n\n").map((para, i) => (
          <p key={i}>
            {para.split("\n").map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        ))}
        <div className="tour-dots">
          {config.steps.map((_, i) => (
            <i key={i} className={i === index ? "on" : i < index ? "past" : ""} />
          ))}
        </div>
        <div className="tour-actions">
          {index > 0 && (
            <button className="tour-back" onClick={back}>
              {ui.back}
            </button>
          )}
          <button className="tour-next" onClick={next}>
            {last ? finishLabel : ui.next}
          </button>
        </div>
      </div>
    </div>
  );
}
