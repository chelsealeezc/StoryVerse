import { describe, expect, it } from "vitest";
import { cityScoreToRadius, storyPosition } from "../src/features/star-lobby/star-position";

describe("StarLobby 地理距离布局", () => {
  it("把中心故事固定在原点", () => {
    expect(storyPosition({ cityScore: 1, isCenterStory: true, angle: 1.2, lift: 0.3 })).toEqual([0, 0, 0]);
  });

  it("cityScore 越小半径越大", () => {
    expect(cityScoreToRadius(1)).toBeCloseTo(1.7);
    expect(cityScoreToRadius(0.5)).toBeCloseTo(4.9);
    expect(cityScoreToRadius(0)).toBeCloseTo(8.1);
  });

  it("角度和高度只改变方向，不改变 cityScore 决定的三维距离", () => {
    const position = storyPosition({ cityScore: 0.5, isCenterStory: false, angle: 2.4, lift: -0.31 });
    expect(Math.hypot(...position)).toBeCloseTo(cityScoreToRadius(0.5), 10);
  });
});
