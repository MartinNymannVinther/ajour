"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PEOPLE_LIST_ID } from "@/modules/projects/constants";
import type { ProjectView, ShareLinkView } from "@/modules/projects/types";
import { ShareDialog } from "./share-dialog";

/**
 * The top of a project: what it is called, what it is for, who owns it and
 * who runs it. The two roles are one click from being changed, because a
 * project with nobody's name on it is the first thing that goes wrong.
 */
export function ProjectHeader({
  project,
  shareLinks,
  onSaveRoles,
  onSaveMeta,
}: {
  project: ProjectView;
  shareLinks: ShareLinkView[];
  onSaveRoles: (owner: string, manager: string) => void;
  onSaveMeta: (name: string, goal: string) => void;
}) {
  const t = useTranslations("projects.header");
  const [editingRoles, setEditingRoles] = useState(false);
  const [roles, setRoles] = useState({ owner: "", manager: "" });
  const [editingMeta, setEditingMeta] = useState(false);
  const [meta, setMeta] = useState({ name: project.name, goal: project.goal });

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {editingMeta ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setEditingMeta(false);
              if (meta.name.trim()) onSaveMeta(meta.name.trim(), meta.goal.trim());
            }}
            className="max-w-2xl space-y-2"
          >
            <Input
              autoFocus
              value={meta.name}
              onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
              aria-label={t("nameLabel")}
              className="text-lg font-semibold"
            />
            <Input
              value={meta.goal}
              onChange={(e) => setMeta((m) => ({ ...m, goal: e.target.value }))}
              placeholder={t("goalPlaceholder")}
              aria-label={t("goalPlaceholder")}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                {t("save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMeta({ name: project.name, goal: project.goal });
                  setEditingMeta(false);
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditingMeta(true)}
            className="hover:text-primary block max-w-2xl text-left"
          >
            <h1 className="font-heading text-2xl font-semibold">{project.name}</h1>
            {project.goal && <p className="text-meta mt-1 text-sm">{project.goal}</p>}
          </button>
        )}

        {editingRoles ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setEditingRoles(false);
              onSaveRoles(roles.owner.trim(), roles.manager.trim());
            }}
            className="mt-2 flex flex-wrap items-center gap-2"
          >
            <Input
              value={roles.owner}
              onChange={(e) => setRoles((r) => ({ ...r, owner: e.target.value }))}
              list={PEOPLE_LIST_ID}
              placeholder={t("owner")}
              aria-label={t("owner")}
              className="w-40"
            />
            <Input
              value={roles.manager}
              onChange={(e) => setRoles((r) => ({ ...r, manager: e.target.value }))}
              list={PEOPLE_LIST_ID}
              placeholder={t("manager")}
              aria-label={t("manager")}
              className="w-40"
            />
            <Button type="submit" size="sm">
              {t("save")}
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setRoles({ owner: project.ownerName, manager: project.managerName });
              setEditingRoles(true);
            }}
            className="text-meta hover:text-primary mt-1.5 inline-flex min-h-[24px] items-center text-xs"
          >
            {t("roles", {
              owner: project.ownerName || t("unset"),
              manager: project.managerName || t("unset"),
            })}
            <span className="text-primary ml-2 font-medium">{t("edit")}</span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <ShareDialog projectId={project.id} links={shareLinks} />
        <Link href={`/projects/${project.id}/status`} className={buttonVariants({ size: "sm" })}>
          {t("newStatus")}
        </Link>
      </div>
    </header>
  );
}
