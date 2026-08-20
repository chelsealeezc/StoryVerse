import type { Story } from "../types/domain";

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const startLatitude = toRadians(latitudeA);
  const endLatitude = toRadians(latitudeB);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

/** 与数据库推荐公式保持一致：500 km 时 cityScore 为 0.5。 */
export function geographicCityScore(
  reference: Pick<Story, "latitude" | "longitude">,
  story: Pick<Story, "latitude" | "longitude">,
) {
  const coordinates = [reference.latitude, reference.longitude, story.latitude, story.longitude];
  if (coordinates.some((coordinate) => coordinate == null || !Number.isFinite(coordinate))) return 0.5;
  const distanceKm = haversineDistanceKm(
    Number(reference.latitude),
    Number(reference.longitude),
    Number(story.latitude),
    Number(story.longitude),
  );
  return 1 / (1 + distanceKm / 500);
}
