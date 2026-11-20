import { defaultPlanHandler } from '@/lib/planner/handler';

export const dynamic = 'force-dynamic';

// Only POST is exported, so Next.js answers other methods with 405.
export const POST = defaultPlanHandler;
