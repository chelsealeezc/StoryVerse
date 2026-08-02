import { cities, cityByName } from "./cities";

export interface PlaceSuggestion {
  id: string;
  name: string;
  detail: string;
  en: string;
  country: string;
  lat: number | null;
  lon: number | null;
  source: "local" | "amap";
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * 高德 key。默认读环境变量，读不到就用仓库里这个（GitHub Pages 直接构建也能跑）。
 * 注意：前端调用意味着 key 会明文出现在打包产物里，请务必在高德控制台给它加
 * 「域名白名单 + 日调用量上限」，并且当成随时可以作废的 key 来用。
 */
const AMAP_KEY: string = import.meta.env.VITE_AMAP_KEY ?? "6c538c72b65391f3366dc9c70edc76a9";
const AMAP_DISTRICT = "https://restapi.amap.com/v3/config/district";

interface AmapDistrict {
  name: string;
  center: string;
  level: string;
  adcode: string;
}

const cache = new Map<string, PlaceSuggestion[]>();

/** 上海市 → 上海；香港特别行政区 → 香港。和本地城市库、故事数据的写法保持一致。 */
function normalizeName(name: string) {
  return name.replace(/特别行政区$/, "").replace(/[市]$/, "");
}

/** 下拉里的副标题。名字本身已经显示了，这里只说清楚「是什么级别」。 */
function amapDetail(item: AmapDistrict) {
  if (/特别行政区$/.test(item.name)) return "特别行政区 · 中国";
  const label = item.level === "province" ? "直辖市" : item.level === "city" ? "地级市" : "区县";
  return `${label} · 中国`;
}

/**
 * 高德行政区划查询：模糊匹配、直接带回经纬度（center = "经度,纬度"）。
 * 只取市 / 区县级；省级只在直辖市、特别行政区时保留。
 * 坐标是 GCJ-02（火星坐标），用于国内地图没问题；本地库那份是 WGS-84，
 * 两者在国内相差几百米，做故事星图的定位完全够用。
 */
async function searchAmap(query: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const url = `${AMAP_DISTRICT}?keywords=${encodeURIComponent(query)}&subdistrict=0&extensions=base&key=${AMAP_KEY}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`amap ${response.status}`);
  const data = await response.json() as { status: string; districts?: AmapDistrict[] };
  if (data.status !== "1" || !data.districts) return [];

  return data.districts
    .filter(item => item.level === "city" || item.level === "district"
      || (item.level === "province" && /(市|特别行政区)$/.test(item.name)))
    // 直辖市会额外返回一条「上海城区」，和「上海市」重复，去掉
    .filter(item => !/城区$/.test(item.name))
    .map(item => {
      const [lon, lat] = item.center.split(",").map(Number);
      return {
        id: `amap-${item.adcode}`,
        name: normalizeName(item.name),
        detail: amapDetail(item),
        en: "",
        country: "中国",
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        source: "amap" as const,
      };
    });
}

function searchLocal(query: string, limit: number): PlaceSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return cities.slice(0, limit).map(toSuggestion);

  return cities
    .map((city, index) => {
      const name = city.name.toLowerCase();
      const en = city.en.toLowerCase();
      const aliases = city.aliases.map(alias => alias.toLowerCase());
      let score = 0;
      if (name === q || en === q) score = 100;
      else if (name.startsWith(q) || en.startsWith(q)) score = 80;
      else if (aliases.some(alias => alias === q || alias.startsWith(q))) score = 70;
      else if (name.includes(q) || en.includes(q) || aliases.some(alias => alias.includes(q))) score = 45;
      else if (city.country.toLowerCase().includes(q)) score = 25;
      return { city, index, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(item => toSuggestion(item.city));
}

/**
 * 城市联想 = 本地城市库（海内外，含英文与别名） + 高德行政区划（国内到区县级）。
 * 高德挂了、超时、或者填的是海外城市，都会安静地退回本地结果，输入框不会因此卡住。
 */
export async function searchPlaces(query: string, limit = 8): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  const local = searchLocal(q, limit);
  // 空输入给默认热门城市；纯英文查询高德查不到，直接用本地库。
  if (!q || !/[一-龥]/.test(q)) return local;

  const cached = cache.get(q);
  if (cached) return cached;

  let remote: PlaceSuggestion[] = [];
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);
  try {
    remote = await searchAmap(q, controller.signal);
  } catch {
    remote = [];
  } finally {
    window.clearTimeout(timeout);
  }

  const merged: PlaceSuggestion[] = [];
  const seen = new Set<string>();
  for (const place of [...local, ...remote]) {
    if (seen.has(place.name)) continue;
    seen.add(place.name);
    merged.push(place);
  }
  const result = merged.slice(0, limit);
  if (remote.length > 0) cache.set(q, result);
  return result;
}

/** 城市名 → 经纬度：先查本地库，查不到再问高德。 */
export async function geocodePlace(name: string): Promise<GeoPoint | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const city = cityByName.get(trimmed);
  if (city) return { lat: city.lat, lon: city.lon };
  const [match] = await searchPlaces(trimmed, 1);
  return match && match.lat !== null && match.lon !== null ? { lat: match.lat, lon: match.lon } : null;
}

export function formatCoords(lat: number | null, lon: number | null) {
  if (lat === null || lon === null) return "";
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

function toSuggestion(city: (typeof cities)[number]): PlaceSuggestion {
  return {
    id: city.id, name: city.name, detail: `${city.en} · ${city.country}`,
    en: city.en, country: city.country, lat: city.lat, lon: city.lon, source: "local",
  };
}
