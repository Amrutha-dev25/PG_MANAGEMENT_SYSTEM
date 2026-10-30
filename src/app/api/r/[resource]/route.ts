import { requireSession } from "@/lib/auth";
import { handler, ok, readJson } from "@/lib/http";
import { listResource, createResource } from "@/lib/crud";

export const GET = handler(async (req: Request, { params }: { params: Promise<{ resource: string }> }) => {
  const s = await requireSession();
  const { resource } = await params;
  return ok(await listResource(resource, s, new URL(req.url).searchParams));
});

export const POST = handler(async (req: Request, { params }: { params: Promise<{ resource: string }> }) => {
  const s = await requireSession();
  const { resource } = await params;
  return ok(await createResource(resource, s, await readJson(req)), 201);
});
