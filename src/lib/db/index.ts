import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

const UNIQUE_VIOLATION = "23505";
const SERIALIZATION_FAILURE = "40001";

let client: NeonQueryFunction<false, false> | undefined;

function getClient(): NeonQueryFunction<false, false> {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add the Neon pooled connection string to .env.local.");
  client = neon(url);
  return client;
}

/**
 * The one Neon client (HTTP, `DATABASE_URL`). Each call is one statement, so every money
 * change is written as a single statement with CTEs. Created on first use, so builds and
 * pages that never query do not need `DATABASE_URL`.
 */
export const sql: NeonQueryFunction<false, false> = new Proxy((() => undefined) as unknown as NeonQueryFunction<false, false>, {
  apply: (_target, _this, args: unknown[]) => Reflect.apply(getClient(), undefined, args),
  get: (_target, property) => Reflect.get(getClient(), property),
});

const errorCode = (error: unknown) => (typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined);

/** True when a database error is a unique violation (`23505`). */
export const isUniqueViolation = (error: unknown) => errorCode(error) === UNIQUE_VIOLATION;

/** True when a REPEATABLE READ or SERIALIZABLE transaction lost a race (`40001`). */
export const isSerializationFailure = (error: unknown) => errorCode(error) === SERIALIZATION_FAILURE;
