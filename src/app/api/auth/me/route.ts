import { requireSession } from "@/lib/auth";
import { handler, ok } from "@/lib/http";

export const GET = handler(async () => ok({ user: await requireSession() }));
