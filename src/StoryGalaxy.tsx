import { CSSProperties, FormEvent, MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Points, PointMaterial } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import gsap from "gsap";
import * as THREE from "three";
import "./story-galaxy.css";
import type { Reaction, Story } from "./types";

type IconName = "compass" | "book" | "tune" | "heart" | "thumbsDown" | "flag" | "plus" | "search" | "x" | "user" | "logout" | "sun" | "moon";
type ViewMode = "explore" | "mine" | "resonance" | "liked" | "write";
type StoryTheme = "city" | "choice" | "family" | "future" | "memory";
type ThemeMode = "night" | "day";
type ResonanceMode = "similar" | "different";
type ResonanceSelection = {
  city: ResonanceMode;
  stage: ResonanceMode;
  theme: ResonanceMode;
};

type StoryNodeData = {
  id: string;
  words: number;
  theme: StoryTheme;
  similarity: number;
  label: string;
  desc: string;
  mine: boolean;
  liked: boolean;
  angle: number;
  lift: number;
};

const navItems = [
  { id: "explore" as ViewMode, zh: "探索故事", en: "Explore", icon: "compass" as IconName },
  { id: "mine" as ViewMode, zh: "我的故事", en: "My stories", icon: "book" as IconName },
  { id: "resonance" as ViewMode, zh: "调整属性", en: "Resonance", icon: "tune" as IconName },
  { id: "liked" as ViewMode, zh: "喜欢记录", en: "Liked", icon: "heart" as IconName },
  { id: "write" as ViewMode, zh: "写下新故事", en: "Write", icon: "plus" as IconName },
];

const galaxyCopy = {
  zh: {
    language: "语言切换",
    theme: "切换白天 / 深夜模式",
    searchOpen: "展开搜索",
    searchClose: "关闭搜索",
    searchPlaceholder: "搜索故事、心境、关键词...",
    closePanel: "关闭故事说明",
    image: "AI 图片",
    escape: "[ESC]",
    stats: (words: number, similarity: number) => `文本长度 ${words} / 相似度 ${Math.round(similarity * 100)}%`,
    legend: "每个星点是一段故事：大小来自文本长度，颜色来自主题，距离来自与你的相似度。",
    account: "个人账户",
    logout: "退出",
    profileTitle: "个人中心",
    profileLead: "管理你在 StoryVerse 中被看见的方式。后端接入后，这些更改会同步到账户数据库。",
    nickname: "修改昵称",
    password: "修改密码",
    email: "修改绑定邮箱",
    feedback: "用户反馈",
    feedbackPlaceholder: "告诉我们你遇到的问题、想要的功能，或任何真实感受……",
    saveProfile: "保存修改",
    profileSaved: "已保存到前端接口位，后端接入后会写入数据库。",
    like: "喜欢",
    dislike: "不喜欢",
    report: "举报",
    reportTitle: "举报这段故事",
    reportLead: "请选择最符合的原因。举报说明仅供审核人员查看。",
    reportReasons: ["隐私泄露", "仇恨或骚扰", "危险内容", "垃圾内容", "其他"],
    reportNote: "补充说明（选填）",
    reportPlaceholder: "请提供有助于审核的上下文……",
    reportContinue: "检查并继续",
    reportConfirmTitle: "确认提交这次举报？",
    reportSubmit: "确认提交举报",
    reportBack: "返回修改",
    reportDoneTitle: "举报已受理",
    reportDoneBody: "谢谢你帮助守护故事社区。审核前不会向故事作者公开你的身份。",
    backToStory: "返回故事",
    resonanceGroups: [["城市", "相近", "不同"], ["人生阶段", "相近", "不同"], ["主题", "相近", "不同"]],
    confirm: "确认",
  },
  en: {
    language: "Switch language",
    theme: "Switch day / night mode",
    searchOpen: "Open search",
    searchClose: "Close search",
    searchPlaceholder: "Search stories, moods, keywords...",
    closePanel: "Close story panel",
    image: "AI Image",
    escape: "[ESC]",
    stats: (words: number, similarity: number) => `${words} words / ${Math.round(similarity * 100)}% match`,
    legend: "Each star is a story: size comes from length, color from theme, distance from similarity to you.",
    account: "Account",
    logout: "Log out",
    profileTitle: "Account center",
    profileLead: "Manage how you appear inside StoryVerse. Once backend is connected, these updates will sync to the account database.",
    nickname: "Nickname",
    password: "Password",
    email: "Bound email",
    feedback: "Feedback",
    feedbackPlaceholder: "Tell us what happened, what you need, or what felt off…",
    saveProfile: "Save changes",
    profileSaved: "Saved to the frontend interface stub. Backend can later persist this to the database.",
    like: "Like",
    dislike: "Dislike",
    report: "Report",
    reportTitle: "Report this story",
    reportLead: "Choose the most fitting reason. Notes are only visible to reviewers.",
    reportReasons: ["Privacy leak", "Hate or harassment", "Dangerous content", "Spam", "Other"],
    reportNote: "Additional note (optional)",
    reportPlaceholder: "Share context that may help reviewers…",
    reportContinue: "Review and continue",
    reportConfirmTitle: "Submit this report?",
    reportSubmit: "Submit report",
    reportBack: "Back to edit",
    reportDoneTitle: "Report received",
    reportDoneBody: "Thank you for helping protect the community. Your identity will not be shown to the author before review.",
    backToStory: "Back to story",
    resonanceGroups: [["City", "Near", "Different"], ["Life stage", "Near", "Different"], ["Theme", "Near", "Different"]],
    confirm: "Confirm",
  },
} as const;

const storyNodes: StoryNodeData[] = [
  { id: "n1", words: 54, theme: "choice", similarity: 0.92, label: "改变人生的决定", desc: "她在二十三岁那年离开熟悉的城市，后来才明白那不是逃离，而是第一次选择自己。", mine: true, liked: true, angle: 0.2, lift: 0.2 },
  { id: "n2", words: 31, theme: "city", similarity: 0.86, label: "异乡第一夜", desc: "凌晨三点的便利店灯光，让他想起很久以前没说出口的告别。", mine: false, liked: true, angle: 1.1, lift: -0.1 },
  { id: "n3", words: 78, theme: "memory", similarity: 0.78, label: "多年后仍会讲起", desc: "有些事过去很久，仍然像星光一样，在每次讲述里重新抵达。", mine: true, liked: false, angle: 2.05, lift: 0.35 },
  { id: "n4", words: 44, theme: "family", similarity: 0.71, label: "给母亲的信", desc: "他终于理解，那些争吵背后藏着两代人不同的害怕。", mine: false, liked: false, angle: 2.85, lift: -0.25 },
  { id: "n5", words: 26, theme: "future", similarity: 0.67, label: "没有走的路", desc: "另一种人生并没有消失，它只是以想象的方式陪你走到今天。", mine: false, liked: true, angle: 3.6, lift: 0.1 },
  { id: "n6", words: 62, theme: "choice", similarity: 0.58, label: "分岔口", desc: "决定发生在很安静的一天，后来所有热闹都从那里开始。", mine: false, liked: false, angle: 4.22, lift: -0.35 },
  { id: "n7", words: 39, theme: "city", similarity: 0.49, label: "雨中的车站", desc: "她突然发现自己记住的不是目的地，而是站台上那些陌生人的脸。", mine: true, liked: false, angle: 4.9, lift: 0.28 },
  { id: "n8", words: 22, theme: "memory", similarity: 0.42, label: "旧照片", desc: "照片里的人都还年轻，像一群不知道答案也仍然出发的人。", mine: false, liked: false, angle: 5.45, lift: -0.15 },
  { id: "n9", words: 47, theme: "future", similarity: 0.36, label: "后来的人生", desc: "他把遗憾换成方向，用很长时间完成一个很小的转身。", mine: false, liked: true, angle: 5.95, lift: 0.4 },
  { id: "n10", words: 88, theme: "family", similarity: 0.82, label: "相似的心境", desc: "远隔重洋的两个人，在同一个夜晚写下了几乎一样的句子。", mine: true, liked: true, angle: 0.72, lift: -0.38 },
  { id: "n11", words: 18, theme: "city", similarity: 0.31, label: "路灯", desc: "那盏灯亮起时，他突然不再觉得自己只是路过。", mine: false, liked: false, angle: 1.74, lift: 0.0 },
  { id: "n12", words: 35, theme: "choice", similarity: 0.55, label: "不一样的观点", desc: "世界很大，我们不怕不同的观点，只怕只能听见一种声音。", mine: false, liked: false, angle: 3.12, lift: 0.22 },
];

const resonanceKeys = ["city", "stage", "theme"] as const;
const defaultResonance: ResonanceSelection = { city: "similar", stage: "different", theme: "similar" };

function applyResonanceToNode(node: StoryNodeData, resonance: ResonanceSelection) {
  const similarCount = resonanceKeys.filter((key) => resonance[key] === "similar").length;
  const differentCount = resonanceKeys.length - similarCount;
  const directionShift = (similarCount - differentCount) * 0.055;
  const themeShift =
    resonance.theme === "similar" && (node.theme === "choice" || node.theme === "city")
      ? 0.08
      : resonance.theme === "different" && (node.theme === "family" || node.theme === "future")
        ? -0.1
        : 0;
  return {
    ...node,
    similarity: Math.max(0.18, Math.min(0.96, node.similarity + directionShift + themeShift)),
  };
}

const themeColors: Record<StoryTheme, string> = {
  city: "#78DDEB",
  choice: "#F6D894",
  family: "#A88CF4",
  future: "#F589BD",
  memory: "#F4F1E6",
};

function nodePosition(node: StoryNodeData) {
  const radius = 1.7 + (1 - node.similarity) * 6.4;
  const spiral = node.angle + radius * 0.24;
  return new THREE.Vector3(Math.cos(spiral) * radius, node.lift, Math.sin(spiral) * radius * 0.62);
}

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, JSX.Element> = {
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15.4 8.6-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H7a3 3 0 0 0-3 3V5.5Z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /></>,
    tune: <><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="8" cy="17" r="2" /></>,
    heart: <path d="M20.8 8.6c0 5.2-8.8 10.4-8.8 10.4S3.2 13.8 3.2 8.6A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8.8 1.9Z" />,
    thumbsDown: <><path d="M10 15v4a3 3 0 0 0 3 3l4-9V3H5.7A2 2 0 0 0 3.8 4.4L2.4 9.4A2 2 0 0 0 4.3 12H10" /><path d="M17 3h2.5A2.5 2.5 0 0 1 22 5.5v5A2.5 2.5 0 0 1 19.5 13H17" /></>,
    flag: <><path d="M5 21V4" /><path d="M5 4c4-2 6 2 10 0v10c-4 2-6-2-10 0" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
    x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    logout: <><path d="M10 17 15 12 10 7" /><path d="M15 12H3" /><path d="M14 4h5v16h-5" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
    moon: <path d="M20.4 14.2A8.2 8.2 0 0 1 9.8 3.6 8.8 8.8 0 1 0 20.4 14.2Z" />,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function buildBackgroundParticles(count: number, radius: number, seed = 7) {
  const positions = new Float32Array(count * 3);
  let value = seed;
  const rand = () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
  for (let i = 0; i < count; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = (rand() - 0.5) * 1.8;
    positions[i * 3 + 2] = Math.sin(a) * r * 0.7;
  }
  return positions;
}

function StarField({ zoom, themeMode }: { zoom: number; themeMode: ThemeMode }) {
  const base = useMemo(() => buildBackgroundParticles(972, 15), []);
  const dense = useMemo(() => buildBackgroundParticles(756, 8, 21), []);
  const isDay = themeMode === "day";
  return (
    <>
      {/* 白天的星点同样偏淡，稍微放大并提高不透明度；夜间数值不动。 */}
      <Points positions={base} stride={3} frustumCulled>
        <PointMaterial transparent color={isDay ? "#1f1a16" : "#ffffff"} size={isDay ? 0.016 : 0.012} sizeAttenuation depthWrite={false} opacity={isDay ? 0.42 : 0.38} />
      </Points>
      <Points positions={dense} stride={3} frustumCulled>
        <PointMaterial transparent color={isDay ? "#3b2b22" : "#ffacd8"} size={(isDay ? 0.009 : 0.007) + zoom * 0.012} sizeAttenuation depthWrite={false} opacity={(isDay ? 0.26 : 0.16) + zoom * 0.18} />
      </Points>
    </>
  );
}

function OrbitalAtlas({ zoom, themeMode }: { zoom: number; themeMode: ThemeMode }) {
  const rings = useMemo(() => Array.from({ length: 22 }, (_, i) => 1.25 + i * 0.46), []);
  const spokes = useMemo(() => Array.from({ length: 20 }, (_, i) => (i / 20) * Math.PI * 2), []);
  const isDay = themeMode === "day";
  const lineColor = isDay ? "#241b14" : "#ffffff";
  const lineBoost = isDay ? 0.26 : 0;
  /**
   * 白天主题下线条几乎看不见，是两个原因叠加的：
   * 1) lineWidth 只有 0.25–0.6，而 drei 的 <Line> 以「像素」为单位，不足 1px 的线
   *    会被光栅化成半透明，等于又打了一次折扣；
   * 2) 深色线画在米白背景上，本身对比度就不如夜间的白线画在纯黑上。
   * 所以白天单独加粗到 1px 以上并提高不透明度；夜间保持原值不变。
   */
  const widthScale = isDay ? 2.8 : 1;
  return (
    <group rotation-x={-Math.PI / 2}>
      {rings.map((r, index) => {
        const points = Array.from({ length: 96 }, (_, i) => {
          const a = (i / 95) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.62, 0);
        });
        return (
          <Line
            key={r}
            points={points}
            color={lineColor}
            transparent
            opacity={(index % 3 === 0 ? 0.1 : 0.052) + zoom * 0.035 + lineBoost}
            lineWidth={(index % 5 === 0 ? 0.6 : 0.35) * widthScale}
            dashed={index % 4 === 0}
            dashSize={0.08}
            gapSize={0.12}
          />
        );
      })}
      {spokes.map((a) => (
        <Line key={a} points={[new THREE.Vector3(Math.cos(a) * 0.8, Math.sin(a) * 0.5, 0), new THREE.Vector3(Math.cos(a) * 12, Math.sin(a) * 7.4, 0)]} color={lineColor} transparent opacity={0.055 + zoom * 0.025 + lineBoost} lineWidth={0.25 * widthScale} />
      ))}
    </group>
  );
}

function StoryNode({ node, active, onSelect, zoom }: { node: StoryNodeData; active: boolean; onSelect: (node: StoryNodeData) => void; zoom: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => nodePosition(node), [node]);
  const color = themeColors[node.theme];
  const size = 0.045 + node.words * 0.0021 + zoom * 0.025;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = Math.sin(clock.elapsedTime * 2.4 + node.angle * 3) * 0.08;
    ref.current.scale.setScalar((active ? 2.25 : 1) + pulse);
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(node);
  };

  return (
    <group position={pos}>
      <mesh ref={ref} onClick={handleClick}>
        <sphereGeometry args={[size, 18, 18]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {active && (
        <mesh>
          <sphereGeometry args={[size * 5.8, 24, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function CameraController({
  selected,
  galaxyRef,
  controlsRef,
  zoom,
}: {
  selected: StoryNodeData | null;
  galaxyRef: MutableRefObject<THREE.Group | null>;
  controlsRef: MutableRefObject<any>;
  zoom: number;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const target = selected && galaxyRef.current
      ? galaxyRef.current.localToWorld(nodePosition(selected).clone())
      : new THREE.Vector3(0.25, -0.08, -1.65);
    const cameraTarget = selected
      ? new THREE.Vector3(target.x - 1.12, target.y + 0.7, target.z + 2.15 - zoom * 0.65)
      : new THREE.Vector3(0, 0.62 - zoom * 0.22, 10.25 - zoom * 1.42);
    const targetProxy = { x: controlsRef.current?.target?.x ?? 0, y: controlsRef.current?.target?.y ?? 0, z: controlsRef.current?.target?.z ?? 0 };
    const tl = gsap.timeline({ defaults: { ease: "power3.inOut", overwrite: "auto" } });

    gsap.to(camera.position, {
      x: cameraTarget.x,
      y: cameraTarget.y,
      z: cameraTarget.z,
      duration: selected ? 0.88 : 0.72,
      ease: "power3.inOut",
      overwrite: "auto",
      onUpdate: () => camera.lookAt(targetProxy.x, targetProxy.y, targetProxy.z),
    });

    tl.to(targetProxy, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: selected ? 0.88 : 0.72,
      onUpdate: () => {
        camera.lookAt(targetProxy.x, targetProxy.y, targetProxy.z);
        if (controlsRef.current) {
          controlsRef.current.target.set(targetProxy.x, targetProxy.y, targetProxy.z);
          controlsRef.current.update();
        }
      },
    }, 0).to(camera, {
      fov: selected ? 34 : 53,
      duration: selected ? 0.88 : 0.72,
      onUpdate: () => camera.updateProjectionMatrix(),
    }, 0);

    return () => {
      tl.kill();
    };
  }, [camera, controlsRef, galaxyRef, selected, zoom]);

  useEffect(() => {
    if (!galaxyRef.current) return;
    if (!selected) {
      gsap.to(galaxyRef.current.rotation, { x: -0.11, y: 0.004, duration: 0.8, ease: "power3.inOut", overwrite: "auto" });
      gsap.to(galaxyRef.current.position, { x: 0, y: 0, z: 0, duration: 0.8, ease: "power3.inOut", overwrite: "auto" });
      gsap.to(galaxyRef.current.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: "power3.inOut", overwrite: "auto" });
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: "power3.inOut" } });
    tl.to(galaxyRef.current.scale, { x: 1.04, y: 1.04, z: 1.04, duration: 0.14, ease: "power2.out" })
      .to(galaxyRef.current.scale, { x: 1, y: 1, z: 1, duration: 0.22, ease: "power2.inOut" })
      .to(galaxyRef.current.rotation, { y: "-=0.12", duration: 0.42, ease: "power3.inOut" }, "<0.02");
    return () => {
      tl.kill();
    };
  }, [galaxyRef, selected]);

  return null;
}

function AnimationTimeline({ galaxyRef, disabled }: { galaxyRef: MutableRefObject<THREE.Group | null>; disabled: boolean }) {
  useEffect(() => {
    if (!galaxyRef.current) return;
    const tl = gsap.timeline({ repeat: -1, defaults: { ease: "none" } });
    tl.to(galaxyRef.current.rotation, { y: "-=6.28318", duration: 300 });
    if (disabled) tl.pause();
    return () => {
      tl.kill();
    };
  }, [disabled, galaxyRef]);
  return null;
}

function GalaxyScene({ activeView, selected, onSelect, zoom, themeMode, resonance, nodes }: { activeView: ViewMode; selected: StoryNodeData | null; onSelect: (node: StoryNodeData | null) => void; zoom: number; themeMode: ThemeMode; resonance: ResonanceSelection; nodes: StoryNodeData[] }) {
  const galaxyRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<any>(null);
  const visibleNodes = useMemo(() => {
    const resonantNodes = nodes.map((node) => applyResonanceToNode(node, resonance));
    if (activeView === "mine") return resonantNodes.filter((node) => node.mine);
    if (activeView === "liked") return resonantNodes.filter((node) => node.liked);
    return resonantNodes;
  }, [activeView, resonance, nodes]);

  return (
    <Canvas camera={{ position: [0, 0.62, 10.25], fov: 53 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={[themeMode === "day" ? "#f4f1e8" : "#000000"]} />
      <fog attach="fog" args={[themeMode === "day" ? "#f4f1e8" : "#000000", 8, 19]} />
      <ambientLight intensity={themeMode === "day" ? 0.42 : 0.16} />
      <group ref={galaxyRef} rotation={[-0.11, 0.004, -0.08]} onClick={() => onSelect(null)}>
        <StarField zoom={zoom} themeMode={themeMode} />
        <OrbitalAtlas zoom={zoom} themeMode={themeMode} />
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.16, 36]} />
          <meshBasicMaterial color={themeMode === "day" ? "#4b3525" : "#fff0fa"} transparent opacity={themeMode === "day" ? 0.42 : 0.9} />
        </mesh>
        {visibleNodes.map((node) => (
          <StoryNode key={node.id} node={node} active={selected?.id === node.id} onSelect={onSelect} zoom={zoom} />
        ))}
      </group>
      <CameraController selected={selected} galaxyRef={galaxyRef} controlsRef={controlsRef} zoom={zoom} />
      <AnimationTimeline galaxyRef={galaxyRef} disabled={Boolean(selected)} />
      <OrbitControls ref={controlsRef} enablePan={false} enableDamping dampingFactor={0.08} minDistance={3.2} maxDistance={13} rotateSpeed={0.32} zoomSpeed={0.45} target={[0.25, -0.08, -1.65]} />
      <EffectComposer>
        <Bloom luminanceThreshold={themeMode === "day" ? 0.82 : 0.5} intensity={themeMode === "day" ? 0.18 : 0.45} mipmapBlur />
        <Vignette eskil={false} offset={0.18} darkness={themeMode === "day" ? 0.28 : 0.86} />
      </EffectComposer>
    </Canvas>
  );
}

type GalaxyReaction = "like" | "dislike" | null;

function StoryPanel({ node, language, onClose, onReact, onReport }: { node: StoryNodeData; language: "zh" | "en"; onClose: () => void; onReact?: (storyId: string, reaction: GalaxyReaction) => void; onReport?: (storyId: string, reason: string, note: string) => Promise<void> }) {
  const t = galaxyCopy[language];
  const [reaction, setReaction] = useState<GalaxyReaction>(null);
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <>
      <aside className="story-panel" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <button
          className="story-panel-close-zone"
          aria-label={t.closePanel}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => {
            event.stopPropagation();
            onClose();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        />
        <button
          className="neon-control story-panel-close"
          tabIndex={-1}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label={t.closePanel}
        >
          <Icon name="x" size={20} />
        </button>
        <div className="story-image-slot">
          <span>{t.image}</span>
          <i>✦</i>
        </div>
        <div className="story-panel-meta">
          <span>{node.theme.toUpperCase()}</span>
          <span>{t.escape}</span>
        </div>
        <h2>{node.label}</h2>
        <p className="story-panel-stats">
          <b style={{ background: themeColors[node.theme] }} />
          {t.stats(node.words, node.similarity)}
        </p>
        <p>{node.desc}</p>
        <div className="story-panel-divider" />
        <div className="story-panel-tags">
          {["异乡", "选择", "记忆", "城市", "共鸣"].map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <div className="story-panel-actions">
          <button className={reaction === "like" ? "is-active like" : ""} onClick={() => { const next=reaction === "like" ? null : "like"; setReaction(next); onReact?.(node.id,next); }}>
            <Icon name="heart" size={16} />{t.like}
          </button>
          <button className={reaction === "dislike" ? "is-active dislike" : ""} onClick={() => { const next=reaction === "dislike" ? null : "dislike"; setReaction(next); onReact?.(node.id,next); }}>
            <Icon name="thumbsDown" size={16} />{t.dislike}
          </button>
          <button onClick={() => setReportOpen(true)}>
            <Icon name="flag" size={16} />{t.report}
          </button>
        </div>
      </aside>
      {reportOpen && <GalaxyReportDialog language={language} node={node} onClose={() => setReportOpen(false)} onSubmit={onReport} />}
    </>
  );
}

function ExpandingSearch({ language }: { language: "zh" | "en" }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const submit = (event: FormEvent) => event.preventDefault();
  const t = galaxyCopy[language];

  if (!expanded) {
    return (
      <button aria-label={t.searchOpen} className="neon-control icon-button" onClick={() => setExpanded(true)}>
        <Icon name="search" size={19} />
      </button>
    );
  }

  return (
    <form className="neon-control search-expanded" onSubmit={submit}>
      <Icon name="search" size={17} />
      <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} />
      <button aria-label={t.searchClose} type="button" onClick={() => { setExpanded(false); setQuery(""); }}>
        <Icon name="x" size={15} />
      </button>
    </form>
  );
}

function FloatingMenu({ activeView, language, onChange }: { activeView: ViewMode; language: "zh" | "en"; onChange: (view: ViewMode) => void }) {
  return (
    <nav aria-label="StoryVerse star map navigation" className="floating-nav">
      {navItems.map((item) => (
        <button key={item.id} className={`neon-control dock-item ${activeView === item.id ? "is-active" : ""}`} onClick={() => onChange(item.id)}>
          <span className="nav-icon"><Icon name={item.icon} /></span>
          <span className="nav-label">{language === "zh" ? item.zh : item.en}</span>
        </button>
      ))}
    </nav>
  );
}

function ResonanceBar({
  language,
  value,
  onChange,
  onConfirm,
}: {
  language: "zh" | "en";
  value: ResonanceSelection;
  onChange: (value: ResonanceSelection) => void;
  onConfirm: () => void;
}) {
  const t = galaxyCopy[language];
  const groups = t.resonanceGroups;
  return (
    <div className="resonance-bar">
      {groups.map(([title, a, b], index) => {
        const key = resonanceKeys[index];
        return (
          <div key={title}>
            <span>{title}</span>
            <button className={value[key] === "similar" ? "is-selected" : ""} onClick={() => onChange({ ...value, [key]: "similar" })}>{a}</button>
            <button className={value[key] === "different" ? "is-selected" : ""} onClick={() => onChange({ ...value, [key]: "different" })}>{b}</button>
          </div>
        );
      })}
      <button className="confirm-resonance" onClick={onConfirm}>{t.confirm}</button>
    </div>
  );
}

function AccountDock({ language, onLogout }: { language: "zh" | "en"; onLogout: () => void }) {
  const t = galaxyCopy[language];
  const [accountOpen, setAccountOpen] = useState(false);
  return (
    <>
      <div className="account-dock">
        <button onClick={() => setAccountOpen(true)}><Icon name="user" size={18} /><span>{t.account}</span></button>
        <button aria-label={t.logout} onClick={onLogout}><Icon name="logout" size={18} /></button>
      </div>
      {accountOpen && <AccountDialog language={language} onClose={() => setAccountOpen(false)} />}
    </>
  );
}

function AccountDialog({ language, onClose }: { language: "zh" | "en"; onClose: () => void }) {
  const t = galaxyCopy[language];
  const [saved, setSaved] = useState(false);
  return (
    <div className="galaxy-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <article className="galaxy-dialog account-dialog">
        <button className="galaxy-dialog-close" onClick={onClose}><Icon name="x" size={18} /></button>
        <p className="galaxy-dialog-eyebrow">Account</p>
        <h2>{t.profileTitle}</h2>
        <p>{saved ? t.profileSaved : t.profileLead}</p>
        <div className="account-form">
          <label>{t.nickname}<input placeholder={language === "zh" ? "StoryVerse 里的名字" : "Your StoryVerse name"} /></label>
          <label>{t.password}<input type="password" placeholder={language === "zh" ? "输入新密码" : "Enter new password"} /></label>
          <label>{t.email}<input type="email" placeholder="zicuili25@stu.pku.edu.cn" /></label>
          <label className="wide">{t.feedback}<textarea placeholder={t.feedbackPlaceholder} /></label>
        </div>
        <button className="galaxy-primary" onClick={() => setSaved(true)}>{t.saveProfile}</button>
      </article>
    </div>
  );
}

function GalaxyReportDialog({ language, node, onClose, onSubmit }: { language: "zh" | "en"; node: StoryNodeData; onClose: () => void; onSubmit?: (storyId: string, reason: string, note: string) => Promise<void> }) {
  const t = galaxyCopy[language];
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="galaxy-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <article className="galaxy-dialog report-dialog-galaxy">
        <button className="galaxy-dialog-close" onClick={onClose}><Icon name="x" size={18} /></button>
        {done ? (
          <>
            <span className="galaxy-success">✓</span>
            <h2>{t.reportDoneTitle}</h2>
            <p>{t.reportDoneBody}</p>
            <button className="galaxy-primary" onClick={onClose}>{t.backToStory}</button>
          </>
        ) : !confirm ? (
          <>
            <p className="galaxy-dialog-eyebrow">Community Safety</p>
            <h2>{t.reportTitle}</h2>
            <p>{t.reportLead}</p>
            <div className="galaxy-report-reasons">
              {t.reportReasons.map((item) => (
                <button key={item} className={reason === item ? "is-selected" : ""} onClick={() => setReason(item)}>
                  {reason === item ? "✓" : "○"} {item}
                </button>
              ))}
            </div>
            <label className="galaxy-note">{t.reportNote}<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t.reportPlaceholder} /></label>
            <button className="galaxy-primary" disabled={!reason} onClick={() => setConfirm(true)}>{t.reportContinue}</button>
          </>
        ) : (
          <>
            <p className="galaxy-dialog-eyebrow">{language === "zh" ? "二次确认" : "Confirm"}</p>
            <h2>{t.reportConfirmTitle}</h2>
            <div className="galaxy-confirm-card"><span>{node.label}</span><b>{reason}</b>{note && <p>{note}</p>}</div>
            <div className="galaxy-dialog-actions">
              <button onClick={() => setConfirm(false)}>{t.reportBack}</button>
              <button className="danger" onClick={() => { void (onSubmit?.(node.id,reason,note) ?? Promise.resolve()).then(() => setDone(true)); }}>{t.reportSubmit}</button>
            </div>
          </>
        )}
      </article>
    </div>
  );
}

export function StoryGalaxy({
  language,
  themeMode,
  onLanguageChange,
  onThemeModeChange,
  onWrite,
  onHome,
  onLogout,
  resonance = defaultResonance,
  onResonanceChange,
  stories = [],
  mineIds = [],
  reactions = {},
  onReact,
  onReport,
}: {
  language: "zh" | "en";
  themeMode: ThemeMode;
  onLanguageChange: (language: "zh" | "en") => void;
  onThemeModeChange: (themeMode: ThemeMode) => void;
  onWrite: () => void;
  onHome: () => void;
  onLogout?: () => void;
  resonance?: ResonanceSelection;
  onResonanceChange?: (resonance: ResonanceSelection) => void;
  stories?: Story[];
  mineIds?: string[];
  reactions?: Record<string, Reaction>;
  onReact?: (storyId: string, reaction: Reaction) => void;
  onReport?: (storyId: string, reason: string, note: string) => Promise<void>;
}) {
  const [activeView, setActiveView] = useState<ViewMode>("explore");
  const [selected, setSelected] = useState<StoryNodeData | null>(null);
  const [zoom, setZoom] = useState(0);
  const [confirmedResonance, setConfirmedResonance] = useState<ResonanceSelection>(resonance);
  const [draftResonance, setDraftResonance] = useState<ResonanceSelection>(resonance);
  const t = galaxyCopy[language];
  const nodes = useMemo<StoryNodeData[]>(() => {
    if (!stories.length) return storyNodes;
    const themeMap: Record<string, StoryTheme> = { 迁移:"city", 城市:"city", 家庭:"family", 关系:"family", 工作:"choice", 身份:"choice", 成长:"future" };
    return stories.map((story,index) => ({
      id: story.id,
      words: story.body.length,
      theme: themeMap[story.theme] || "memory",
      similarity: Math.max(0.28,0.92-index*0.055),
      label: story.title,
      desc: story.body,
      mine: mineIds.includes(story.id),
      liked: reactions[story.id] === "like",
      angle: (index / Math.max(stories.length,1)) * Math.PI * 2,
      lift: ((index % 5)-2)*0.16,
    }));
  },[stories,mineIds,reactions]);

  useEffect(() => {
    setConfirmedResonance(resonance);
    setDraftResonance(resonance);
  }, [resonance]);

  const handleWheel = (event: React.WheelEvent<HTMLElement>) => {
    setZoom((current) => Math.max(0, Math.min(1, current + (event.deltaY < 0 ? 0.12 : -0.12))));
  };
  const handleViewChange = (view: ViewMode) => {
    setSelected(null);
    if (view === "write") {
      onWrite();
      return;
    }
    if (view === "resonance") {
      setDraftResonance(confirmedResonance);
    }
    setActiveView(view);
  };

  const confirmResonance = () => {
    setConfirmedResonance(draftResonance);
    onResonanceChange?.(draftResonance);
    setActiveView("explore");
  };

  return (
    <main className="storyverse-root" data-theme={themeMode} onWheel={handleWheel}>
      <GalaxyScene activeView={activeView} selected={selected} onSelect={setSelected} zoom={zoom} themeMode={themeMode} resonance={confirmedResonance} nodes={nodes} />
      <div className="meteor meteor-one" />
      <div className="meteor meteor-two" />
      <div className="meteor meteor-three" />
      <header className="top-overlay">
        <button className="brand brand-button" onClick={onHome} aria-label={language === "zh" ? "回到首页" : "Back home"}><span>Story</span>Verse</button>
        <div className="header-actions">
          <button className="neon-control theme-button" aria-label={t.theme} onClick={() => onThemeModeChange(themeMode === "night" ? "day" : "night")}>
            <Icon name={themeMode === "night" ? "sun" : "moon"} size={20} />
          </button>
          <button className="neon-control lang-button" aria-label={t.language} onClick={() => onLanguageChange(language === "zh" ? "en" : "zh")}>
            <span className={language === "zh" ? "lang-primary" : "lang-secondary"}>中文</span>
            <span className="lang-divider" />
            <span className={language === "en" ? "lang-primary" : "lang-secondary"}>ENG</span>
          </button>
          <ExpandingSearch language={language} />
        </div>
      </header>
      <p className="bottom-legend">{t.legend}</p>
      {selected && <StoryPanel node={selected} language={language} onClose={() => setSelected(null)} onReact={onReact} onReport={onReport} />}
      {activeView === "resonance" && <ResonanceBar language={language} value={draftResonance} onChange={setDraftResonance} onConfirm={confirmResonance} />}
      <AccountDock language={language} onLogout={onLogout ?? onHome} />
      <FloatingMenu activeView={activeView} language={language} onChange={handleViewChange} />
    </main>
  );
}

export const styles: Record<string, CSSProperties> = {};
