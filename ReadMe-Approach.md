# Approach, Review, and Verification

This document explains the implementation for Tickets 1 through 7 in `README.MD`, the decisions I would keep or change after reviewing the code, and how I verified the result.

## Review conclusion

The implementation meets the required behavior:

- The address schema and TypeScript address type include `state`.
- `createAddress` creates a new record and rejects duplicate usernames.
- The required `client` header is validated before resolver execution.
- `strata` clients can run queries but cannot run mutations.
- A request ID is generated early, added to the logger, and returned in response metadata.
- The client header and request ID are included in logger output.
- Tests exercise the GraphQL request path rather than only isolated helper functions.

I did not find a blocking correctness issue in the first seven tickets. The main review considerations are keeping the public naming explicit and using asynchronous file I/O for the address persistence layer.

## Ticket 1: Address state

`state` was added to both the GraphQL address model and the TypeScript `Address` type. The output field remains nullable so existing records without a state can still be read, while `AddressInput.state` is required for new records.

Keeping the two definitions synchronized is important because GraphQL validates the external request, while TypeScript validates the resolver implementation. Updating both prevents the schema and runtime model from drifting apart.

## Ticket 2: Create an address

The mutation follows the existing file-backed design:

1. Read `addresses.json`.
2. Check whether the username already exists.
3. Reject duplicates with `GraphQLError`.
4. Add the new address.
5. Write the updated collection back to the file.
6. Return the created address.

The public operation remains named `createAddress` because the ticket describes a create operation, not an update. Keeping that name makes the GraphQL contract explicit and avoids implying that an existing address can be overwritten.

Existing synchronous file access can block the event loop, so async/await keeps it responsive and ensures the mutation finishes writing before returning success. Although this is a small project, I prefer this approach as good practice for handling I/O.


## Async/await change

The address persistence functions use promise-based filesystem APIs:

```ts
const readAddresses = async (): Promise<Addresses> => {
  const raw = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as Addresses;
};

const writeAddresses = async (addresses: Addresses): Promise<void> => {
  await fs.promises.writeFile(
    filePath,
    JSON.stringify(addresses, null, 2),
    'utf-8',
  );
};
```

## Tickets 3, 4, and 5: Request headers and logging

Request-wide behavior is centralized in the Envelop plugin instead of being repeated in every resolver.

- `onContextBuilding` reads and validates `client`, creates `requestId`, and adds both values to context.
- `onExecute` blocks mutations for `strata` clients.
- `onParse` creates the logger and copies `requestId` and `client` into it.
- The logger includes those values in each log entry.

This lifecycle placement is correct because the request metadata exists before resolver execution and is shared across the whole request. It also keeps domain resolvers focused on address behavior.

## Ticket 6: Response metadata

The execution completion hook adds the request ID to the GraphQL response extensions after resolver execution. The request ID comes from the same context value used by the logger, so logs and responses can be correlated:

```json
{
  "extensions": {
    "metadata": {
      "requestId": "..."
    }
  }
}
```

Existing extensions are preserved when the response is enriched.

## Ticket 7: Tests

The tests verify the request-level behavior through the GraphQL executor, including:

- Address queries and mutations.
- Duplicate address rejection.
- Required client-header validation.
- `strata` query and mutation behavior.
- Request metadata and logger behavior.

Test cases were updated to use async/await, ensuring the GraphQL queries and mutations correctly handle asynchronous resolver operations.

## Verification

The following checks were run after the changes:

```text
npm test -- --runInBand
PASS - 3 suites, 8 tests

npx tsc --noEmit -p tsconfig.json
PASS - no TypeScript errors

npx tsc --noEmit -p tsconfig.test.json
PASS - no TypeScript errors

git diff --check
PASS - no whitespace errors
```

These checks are relevant because the full Jest suite exercises the GraphQL request flow, both TypeScript projects verify the promise return types and resolver integration, and `git diff --check` catches formatting mistakes. Together they support the conclusion that the Ticket 1-7 changes preserve the required behavior while improving the address I/O implementation without changing the public GraphQL contract.
