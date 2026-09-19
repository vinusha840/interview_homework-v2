# Sprint 2 Solution

This document explains how Ticket 8, the NASA Near Earth Objects (NEO) Feed Integration, was implemented using GraphQL Mesh v0 and GraphQL Yoga.

## 1. Installed GraphQL Mesh dependencies

The project uses the GraphQL Mesh v0 packages required for the JSON Schema integration:

- `@graphql-mesh/cli`
- `@graphql-mesh/json-schema`
- `@graphql-mesh/runtime`

These dependencies allow the existing GraphQL Yoga server to call a REST API through a generated Mesh runtime instead of implementing the NASA HTTP request manually in the resolver.

## 2. Configured the NASA REST API source

A root `.meshrc.yml` file configures the NASA NEO Feed source.

The configuration defines:

- NASA's endpoint: `https://api.nasa.gov`
- HTTP method: `GET`
- REST path: `/neo/rest/v1/feed`
- API key query parameter
- Mapping from GraphQL `startDate` to NASA `start_date`
- Mapping from GraphQL `endDate` to NASA `end_date`
- Mesh operation name: `nearEarthObjects`

The relevant API request is conceptually:

```text
GET https://api.nasa.gov/neo/rest/v1/feed
  ?api_key=...
  &start_date=2015-09-06
  &end_date=2015-09-07
```

The key is kept in the Mesh configuration for the running environment and is not included in this documentation.

## 3. Defined the dynamic response schema

The NASA response contains date-keyed data:

```json
{
  "element_count": 25,
  "near_earth_objects": {
    "2015-09-06": [],
    "2015-09-07": []
  }
}
```

The file `data/nasa-neo.schema.json` describes this response to Mesh. It is a JSON Schema definition, not a live API response and not an API call.

The important configuration is:

```json
{
  "near_earth_objects": {
    "type": "object",
    "additionalProperties": true
  }
}
```

`additionalProperties: true` is required because the date property names change for every request. This prevents Mesh from generating fixed fields only for dates found in a sample response.

## 4. Generated the Mesh SDK

The generated Mesh artifacts are created by running:

```bash
npm run mesh:build
```

This creates the `.mesh` directory, including the generated schema and runtime. The folder is generated during the build command; it is not rebuilt for every GraphQL request.

The generated Mesh runtime is loaded in `src/schema/neo/nearEarthObjects.ts`:

```ts
const mesh = await getBuiltMesh();
const requester = mesh.sdkRequesterFactory(context);
const payload = await requester(nearEarthObjectsQuery, args);
```

The internal `nearEarthObjectsQuery` is a GraphQL document used by Mesh's requester. Mesh uses the generated operation metadata to translate that operation into the NASA REST request.

## 5. Exposed the public GraphQL schema

The public query is defined in `src/schema/schema.graphql`:

```graphql
nearEarthObjects(startDate: String!, endDate: String!): NearEarthObjectFeed
```

The NEO-specific types are defined in `src/schema/neo/neo.graphql`:

```graphql
type NearEarthObjectFeed {
  elementCount: Int
  objects: [NearEarthObject]
}

type NearEarthObject {
  id: String
  name: String
  isPotentiallyHazardousAsteroid: Boolean
  estimatedDiameterMinKm: Float
  estimatedDiameterMaxKm: Float
  closeApproachDate: String
  relativeVelocityKph: String
  missDistanceKm: String
}
```

Only the fields required by the ticket are exposed. Other NASA response fields remain internal and are not included in the public GraphQL contract.

## 6. Kept the root resolver simple

`src/schema/resolvers.ts` contains a thin resolver that delegates the NEO operation to `getNearEarthObjects`.

The NEO-specific work is kept in `src/schema/neo/nearEarthObjects.ts`, including:

- Cache lookup
- Mesh SDK initialization
- Mesh request execution
- Response mapping
- Cache storage
- Source-specific logging

This keeps the root resolver small and keeps NEO logic inside the NEO folder.

## 7. Mapped and flattened the NASA response

The mapper is implemented in `src/schema/neo/nearEarthObjectsMapper.ts`.

It performs the following steps:

1. Reads `element_count` and `near_earth_objects` from the Mesh payload.
2. Builds the requested date range from `startDate` through `endDate`.
3. Finds the asteroid list for each requested date.
4. Supports NASA date keys such as `2015-09-06` and Mesh-compatible keys such as `_2015_09_06`.
5. Flattens all date-specific arrays into one `objects` array.
6. Renames NASA snake_case fields to the public GraphQL camelCase fields.
7. Returns only the fields required by `NearEarthObject`.

For example, NASA's:

```json
{
  "is_potentially_hazardous_asteroid": false,
  "estimated_diameter": {
    "kilometers": {
      "estimated_diameter_min": 0.08,
      "estimated_diameter_max": 0.17
    }
  }
}
```

becomes:

```json
{
  "isPotentiallyHazardousAsteroid": false,
  "estimatedDiameterMinKm": 0.08,
  "estimatedDiameterMaxKm": 0.17
}
```

## 8. Added caching

The cache is implemented in `src/schema/neo/nearEarthObjectsCache.ts`.

It uses:

- An in-memory `Map`
- A cache key made from `startDate` and `endDate`
- A five-minute TTL

When the same date range is requested within five minutes, the cached mapped result is returned without calling Mesh or NASA again.

The cache is process-local. It is cleared when the server restarts and is not a persistent or distributed cache.

## 9. Added source-specific logging

The service logs whether the returned data came from the cache or the live NASA API through Mesh.

For a cache hit, the log message is:

```text
NEO data is from cache
```

For a live request, the log messages are:

```text
NEO data is being fetched from the Live API using Mesh
NEO data was fetched from the Live API using Mesh
```

This means the returned asteroid objects came from NASA's live REST API through GraphQL Mesh.

The logs also include:

- Data source
- Start date
- End date
- Number of returned objects

This makes it easy to identify whether a request called NASA or used the cache.

## 10. Run the application

Install dependencies:

```bash
npm install
```

Generate the Mesh SDK:

```bash
npm run mesh:build
```

Start the GraphQL Yoga server:

```bash
npm run dev
```

The GraphQL endpoint is:

```text
http://localhost:4000/graphql
```

The existing request-header plugin requires a `client` header. Example:

```json
{
  "client": "test-client"
}
```

## 11. Test the query

Use this query in GraphiQL or another GraphQL client:

```graphql
query NearEarthObjects($startDate: String!, $endDate: String!) {
  nearEarthObjects(startDate: $startDate, endDate: $endDate) {
    elementCount
    objects {
      id
      name
      isPotentiallyHazardousAsteroid
      estimatedDiameterMinKm
      estimatedDiameterMaxKm
      closeApproachDate
      relativeVelocityKph
      missDistanceKm
    }
  }
}
```

Variables:

```json
{
  "startDate": "2015-09-06",
  "endDate": "2015-09-07"
}
```

Headers:

```json
{
  "client": "test-client"
}
```

## 12. Logs You Will See

When the requested date range is not in the cache, the server logs that it is calling the live NASA API through Mesh:

```text
NEO data is being fetched from the Live API using Mesh
NEO data was fetched from the Live API using Mesh
```

The structured log entries also contain values similar to:

```json
{
  "source": "mesh-api",
  "startDate": "2015-09-06",
  "endDate": "2015-09-07",
  "objectCount": 25
}
```

When the same date range is requested again within five minutes, Mesh and NASA are skipped. The server logs:

```text
NEO data is from cache
```

This means the returned asteroid objects came from the local five-minute cache, so NASA was not called for that request.

The cache log includes:

```json
{
  "source": "cache",
  "startDate": "2015-09-06",
  "endDate": "2015-09-07",
  "objectCount": 25
}
```




## Project Files

| File | Purpose |
| --- | --- |
| `.meshrc.yml` | NASA REST source configuration for Mesh |
| `data/nasa-neo.schema.json` | Dynamic response shape used by Mesh |
| `.mesh/` | Generated Mesh schema and runtime |
| `src/schema/schema.graphql` | Root GraphQL query definition |
| `src/schema/neo/neo.graphql` | Public NEO types |
| `src/schema/neo/nearEarthObjects.ts` | Mesh request, cache, logging, and orchestration |
| `src/schema/neo/nearEarthObjectsMapper.ts` | Response mapping and flattening |
| `src/schema/neo/nearEarthObjectsCache.ts` | Five-minute in-memory cache |
| `src/schema/neo/types.ts` | TypeScript NEO types |
| `src/schema/resolvers.ts` | Thin resolver delegation |

## 13. Design Questions

### How does the JSON Schema handler infer the Mesh schema?

The `jsonSchema` handler reads the response schema configured in `.meshrc.yml`:

```yaml
responseSchema: ./data/nasa-neo.schema.json
```

The schema describes the NASA response shape: `element_count` is an integer and `near_earth_objects` is an object with dynamic date properties. The `additionalProperties: true` setting allows dates such as `2015-09-06` and `2015-09-07` without generating a fixed field for every possible date.

The JSON Schema does not call NASA and does not contain live response data. It tells Mesh how to interpret the response returned by the endpoint configured in `.meshrc.yml`.

### How are fields filtered and renamed?

Mesh represents the raw NASA response internally. The public schema in `src/schema/neo/neo.graphql` defines the smaller client-facing contract. The mapper in `src/schema/neo/nearEarthObjectsMapper.ts` then:

- Selects only the fields required by the ticket.
- Renames NASA snake_case fields to GraphQL camelCase fields.
- Converts `near_earth_objects` into the public `objects` list.

This keeps NASA-specific fields and names out of the public API.

### Where should date-keyed flattening happen?

Date-keyed flattening belongs in `nearEarthObjectsMapper.ts`, not in the root resolver. The root resolver only delegates to `getNearEarthObjects`. The NEO service handles the request flow, while the mapper handles response transformation. This keeps each part focused and makes the transformation easier to test.

### How is the NASA response cached?

`nearEarthObjectsCache.ts` uses an in-memory `Map` with a five-minute TTL. The cache key contains the requested start and end dates.

- On a cache hit, the mapped result is returned and NASA is not called.
- On a cache miss, Mesh calls NASA, the response is mapped, and the result is stored.

This is appropriate for a single-process assignment because it needs no extra infrastructure. For multiple application instances or production workloads, Redis or another shared cache would be more suitable because all instances could reuse the same NASA response.
