import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { moduleForEntity } from "@/lib/documents";
import { userHasPermission } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/documents/[id]">,
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }

  const allowed = await canAccessDocument(session.user.id, doc);
  if (!allowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const buffer = await storage.read(doc.storageKey);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.filename)}"`,
    },
  });
}

async function canAccessDocument(
  userId: string,
  doc: { entityType: string; entityId: string },
) {
  const entityModule = moduleForEntity(doc.entityType);
  if (await userHasPermission(userId, entityModule, "view")) return true;

  // Self-scoping fallback: an employee can always reach documents attached
  // to their own employee record, even without a general hr:view grant.
  if (doc.entityType === "employee") {
    const employee = await prisma.employee.findUnique({
      where: { id: doc.entityId },
      select: { userId: true },
    });
    if (employee?.userId === userId) return true;
  }

  return false;
}
