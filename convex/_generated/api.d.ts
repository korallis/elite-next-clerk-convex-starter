/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as dashboards from "../dashboards.js";
import type * as http from "../http.js";
import type * as orgConnections from "../orgConnections.js";
import type * as paymentAttemptTypes from "../paymentAttemptTypes.js";
import type * as paymentAttempts from "../paymentAttempts.js";
import type * as queryAudits from "../queryAudits.js";
import type * as semanticArtifacts from "../semanticArtifacts.js";
import type * as semanticSyncRuns from "../semanticSyncRuns.js";
import type * as users from "../users.js";
import type * as utils_adminAuth from "../utils/adminAuth.js";
import type * as utils_encryption from "../utils/encryption.js";
import type * as validators_connection from "../validators/connection.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  dashboards: typeof dashboards;
  http: typeof http;
  orgConnections: typeof orgConnections;
  paymentAttemptTypes: typeof paymentAttemptTypes;
  paymentAttempts: typeof paymentAttempts;
  queryAudits: typeof queryAudits;
  semanticArtifacts: typeof semanticArtifacts;
  semanticSyncRuns: typeof semanticSyncRuns;
  users: typeof users;
  "utils/adminAuth": typeof utils_adminAuth;
  "utils/encryption": typeof utils_encryption;
  "validators/connection": typeof validators_connection;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
