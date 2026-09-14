import { RateLimiter, HOUR, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
export const limits = new RateLimiter(components.rateLimiter, {
  marketingGlobal: { kind: "token bucket", rate: 30, period: HOUR, capacity: 30 },
  marketingEmail: { kind: "token bucket", rate: 2, period: HOUR, capacity: 2 },
  marketingEvent: { kind: "token bucket", rate: 600, period: HOUR, capacity: 600 },
  supplierAssessment: { kind: "token bucket", rate: 20, period: HOUR, capacity: 20 },
  sourceImport: { kind: "token bucket", rate: 20, period: HOUR, capacity: 20 },
  verifyEmail: { kind: "token bucket", rate: 3, period: HOUR, capacity: 3 },
  verifyAddress: { kind: "token bucket", rate: 3, period: HOUR, capacity: 3 },
  verifyAttempt: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
});
