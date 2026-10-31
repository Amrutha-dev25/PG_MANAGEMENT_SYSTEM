import { requireSession } from "@/lib/auth";
import { handler, ok, readJson } from "@/lib/http";
import { deleteResource, getResource, updateResource } from "@/lib/crud";

// Fetch one record. ResourcePage uses this when the user clicks Edit.
export const GET = handler(async (req: Request, { params }: { params: Promise<{ resource: string; id: string }> }) => {
  const session = await requireSession();
  const { resource, id } = await params;
  return ok(await getResource(resource, session, id));
});

// Update one record. ResourcePage submits edits with PUT.
export const PUT = handler(async (req: Request, { params }: { params: Promise<{ resource: string; id: string }> }) => {
  const session = await requireSession();
  const { resource, id } = await params;
  return ok(await updateResource(resource, session, id, await readJson(req)));
});

// Also accept PATCH for clients that send partial updates.
export const PATCH = PUT;

// Delete one record.
export const DELETE = handler(async (req: Request, { params }: { params: Promise<{ resource: string; id: string }> }) => {
  const session = await requireSession();
  const { resource, id } = await params;
  return ok(await deleteResource(resource, session, id));
});
