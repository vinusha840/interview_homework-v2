import type { NearEarthObject, NearEarthObjectFeed } from './types';

const getRequestedDates = (startDate: string, endDate: string): string[] => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

export const mapNearEarthObjectFeed = (
  payload: any,
  startDate: string,
  endDate: string,
): NearEarthObjectFeed => {
  const objectsByDate = payload.near_earth_objects ?? {};
  const requestedDates = new Set(getRequestedDates(startDate, endDate));

  const objects = Array.from(requestedDates).flatMap((date) => {
    const generatedDateKey = `_${date.replace(/-/g, '_')}`;
    const dayObjects = Array.isArray(objectsByDate[date])
      ? objectsByDate[date]
      : Array.isArray(objectsByDate[generatedDateKey])
        ? objectsByDate[generatedDateKey]
        : [];

    return dayObjects.map((object: any): NearEarthObject => {
      const approach = Array.isArray(object.close_approach_data) ? object.close_approach_data[0] : {};
      const diameter = object.estimated_diameter.kilometers ?? {};

      return {
        id: String(object.id ?? ''),
        name: String(object.name ?? ''),
        isPotentiallyHazardousAsteroid: Boolean(object.is_potentially_hazardous_asteroid),
        estimatedDiameterMinKm: Number(diameter.estimated_diameter_min ?? 0),
        estimatedDiameterMaxKm: Number(diameter.estimated_diameter_max ?? 0),
        closeApproachDate: String(approach.close_approach_date ?? date),
        relativeVelocityKph: String(approach.relative_velocity.kilometers_per_hour ?? '0'),
        missDistanceKm: String(approach.miss_distance.kilometers ?? '0'),
      };
    });
  });

  return {
    elementCount: Number(payload?.element_count ?? objects.length),
    objects,
  };
};
