import { requireSession } from "@/lib/auth";
import { handler, ok, readJson } from "@/lib/http";
import { getResource, updateResource, deleteResource } from "@/lib/crud";

type Ctx = { params: Promise<{ resource: string; id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession(); const { resource, id } = await params;
  return ok(await getResource(resource, s, decodeURIComponent(id)));
});
export const PUT = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession(); const { resource, id } = await params;
  return ok(await updateResource(resource, s, decodeURIComponent(id), await readJson(req)));
});
export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession(); const { resource, id } = await params;
  return ok(await deleteResource(resource, s, decodeURIComponent(id)));
});
