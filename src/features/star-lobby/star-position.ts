const INNER_RADIUS = 1.7;
const RADIAL_RANGE = 6.4;

function clampCityScore(cityScore: number) {
  return Math.max(0, Math.min(1, Number.isFinite(cityScore) ? cityScore : 0.5));
}

export function cityScoreToRadius(cityScore: number, isCenterStory = false) {
  if (isCenterStory) return 0;
  return INNER_RADIUS + (1 - clampCityScore(cityScore)) * RADIAL_RANGE;
}

/**
 * 角度和高度只负责把故事稳定地摊开；向量归一化后，故事到原点的真实三维距离
 * 始终只由 cityScore 决定。
 */
export function storyPosition(input: {
  cityScore: number;
  isCenterStory: boolean;
  angle: number;
  lift: number;
}): [number, number, number] {
  const radius = cityScoreToRadius(input.cityScore, input.isCenterStory);
  if (radius === 0) return [0, 0, 0];
  const spiral = input.angle + radius * 0.24;
  const direction: [number, number, number] = [Math.cos(spiral), input.lift, Math.sin(spiral) * 0.62];
  const directionLength = Math.hypot(...direction) || 1;
  return direction.map((coordinate) => (coordinate / directionLength) * radius) as [number, number, number];
}
