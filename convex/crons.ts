import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval("Check company stock and deliveries", { hours: 1 }, internal.companyAlerts.sweep, {
  paginationOpts: { numItems: 25, cursor: null },
});
export default crons;
