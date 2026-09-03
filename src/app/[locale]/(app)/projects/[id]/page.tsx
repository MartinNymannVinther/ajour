import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireOrgContext } from "@/core/auth/guard";
import { todayInCopenhagen } from "@/core/dates";
import { ProjectView } from "@/components/project/project-view";
import { listChat } from "@/modules/ai/chat";
import { getProjectFull } from "@/modules/projects/read";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const context = await requireOrgContext();
  if (!context) return {};
  const { id } = await params;
  const full = await getProjectFull(context, id);
  return { title: full?.project.name };
}

/**
 * One project. Everything on this page is read through the workspace's
 * own context, so a project id from another workspace is simply not
 * there — the ownership check and the row-level policy are the same thing.
 */
export default async function ProjectPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const full = await getProjectFull(context, id);
  if (!full) notFound();
  const chat = await listChat(context, id);

  return (
    <ProjectView
      full={full}
      today={todayInCopenhagen()}
      chatHistory={chat.map((row) => ({
        role: row.role,
        content: row.content,
        applied: row.applied,
      }))}
    />
  );
}
