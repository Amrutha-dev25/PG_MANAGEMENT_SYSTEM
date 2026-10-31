import { requireSession } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { optionsFor } from "@/lib/crud";

export const GET = handler(async (req: Request, { params }: { params: Promise<{ resource: string }> }) => {
  const s = await requireSession(); const { resource } = await params;
  return ok({ options: await optionsFor(resource, s, new URL(req.url).searchParams) });
});
