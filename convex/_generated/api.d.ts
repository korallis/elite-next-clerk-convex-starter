/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _shared_metrics_stakeholder from "../_shared/metrics/stakeholder.js";
import type * as connectionDrafts from "../connectionDrafts.js";
import type * as dashboards from "../dashboards.js";
import type * as http from "../http.js";
import type * as metrics from "../metrics.js";
import type * as orgConnections from "../orgConnections.js";
import type * as orgSettings from "../orgSettings.js";
import type * as paymentAttemptTypes from "../paymentAttemptTypes.js";
import type * as paymentAttempts from "../paymentAttempts.js";
import type * as prompts from "../prompts.js";
import type * as queryAudits from "../queryAudits.js";
import type * as retention from "../retention.js";
import type * as risks from "../risks.js";
import type * as semanticArtifacts from "../semanticArtifacts.js";
import type * as semanticCatalog from "../semanticCatalog.js";
import type * as semanticSyncRuns from "../semanticSyncRuns.js";
import type * as semanticSyncStages from "../semanticSyncStages.js";
import type * as users from "../users.js";
import type * as utils_adminAuth from "../utils/adminAuth.js";
import type * as utils_encryption from "../utils/encryption.js";
import type * as validators_connection from "../validators/connection.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "_shared/metrics/stakeholder": typeof _shared_metrics_stakeholder;
  connectionDrafts: typeof connectionDrafts;
  dashboards: typeof dashboards;
  http: typeof http;
  metrics: typeof metrics;
  orgConnections: typeof orgConnections;
  orgSettings: typeof orgSettings;
  paymentAttemptTypes: typeof paymentAttemptTypes;
  paymentAttempts: typeof paymentAttempts;
  prompts: typeof prompts;
  queryAudits: typeof queryAudits;
  retention: typeof retention;
  risks: typeof risks;
  semanticArtifacts: typeof semanticArtifacts;
  semanticCatalog: typeof semanticCatalog;
  semanticSyncRuns: typeof semanticSyncRuns;
  semanticSyncStages: typeof semanticSyncStages;
  users: typeof users;
  "utils/adminAuth": typeof utils_adminAuth;
  "utils/encryption": typeof utils_encryption;
  "validators/connection": typeof validators_connection;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
