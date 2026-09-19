import { parse } from "graphql";
import { getBuiltMesh } from "../../../.mesh";
import { ContextType } from "../../types";
import { cacheNearEarthObjects, getCachedNearEarthObjects } from "./nearEarthObjectsCache";
import { mapNearEarthObjectFeed } from "./nearEarthObjectsMapper";
import { NearEarthObjectFeed, NearEarthObjectsArgs } from "./types";

const nearEarthObjectsQuery = parse(`
  query NearEarthObjects($startDate: String!, $endDate: String!) {
    nearEarthObjects(startDate: $startDate, endDate: $endDate) {
      element_count
      near_earth_objects
    }
  }
`);

export const getNearEarthObjects = async (
  args: NearEarthObjectsArgs,
  context: ContextType,
): Promise<NearEarthObjectFeed> => {
  const cachedResult = getCachedNearEarthObjects(args.startDate, args.endDate);
  if (cachedResult) {
    context.logger.info("NEO data is from cache", {
      source: "cache",
      startDate: args.startDate,
      endDate: args.endDate,
      objectCount: cachedResult.objects.length,
    });
    return cachedResult;
  }

  context.logger.info("NEO data is being fetched from the Live API using Mesh", {
    source: "mesh-api",
    startDate: args.startDate,
    endDate: args.endDate,
  });

  const mesh = await getBuiltMesh();
  const requester = mesh.sdkRequesterFactory(context);
  const payload = await requester(nearEarthObjectsQuery, args);
  const result = mapNearEarthObjectFeed(
    payload?.nearEarthObjects ?? payload,
    args.startDate,
    args.endDate,
  );

  cacheNearEarthObjects(args.startDate, args.endDate, result);
  context.logger.info("NEO data was fetched from the Live API using Mesh", {
    source: "mesh-api",
    startDate: args.startDate,
    endDate: args.endDate,
    objectCount: result.objects.length,
  });

  return result;
};
