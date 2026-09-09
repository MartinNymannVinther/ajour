import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrgContext } from "@/core/auth/session";
import { redirect } from "@/i18n/navigation";
import { RULES_ENGINE_NAME } from "@/modules/ai";
import {
  MAX_CALLS_PER_USER_PER_HOUR,
  MAX_CALLS_PER_WORKSPACE_PER_DAY,
  MAX_CHAT_CHARS,
} from "@/modules/ai/limits";
import { getModelSettings } from "@/modules/ai/model-settings";
import { currentRole } from "@/modules/export/workspace";
import { ModelForm } from "./model-form";
import { TestConnection } from "./test-connection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.ai");
  return { title: t("title") };
}

/**
 * Which engine answers, and what it is allowed to do. The page says
 * plainly that the tool works without a model at all: the rules engine
 * covers the three flows, so cutting the internet costs quality, not the
 * ability to run a project.
 *
 * The workspace can also choose its own model. The installation's setting
 * is the default it inherits, and the card shows what is actually in
 * force before it shows the form that changes it.
 */
export default async function AiSettingsPage() {
  const context = await getOrgContext();
  if (!context) {
    redirect({ href: "/login", locale: await getLocale() });
    return null;
  }

  const t = await getTranslations("settings.ai");
  const settings = await getModelSettings(context);
  const role = await currentRole(context);
  const canEdit = role === "owner" || role === "admin";
  const active = settings.effective.provider !== "none" && settings.effective.model !== "";

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-meta text-[0.78rem] leading-relaxed">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-primary size-4" />
            {t("providerTitle")}
          </CardTitle>
          <CardDescription>{t("providerHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {active ? (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("provider")}</span>
                <Badge className="bg-primary/15 text-primary border-transparent">
                  {t(`model.provider_${settings.effective.provider}`)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("model.current")}</span>
                <span className="font-medium tabular-nums">{settings.effective.model}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("model.source")}</span>
                <span className="text-meta">
                  {settings.choice === "inherit"
                    ? t("model.fromInstallation")
                    : t("model.fromWorkspace")}
                </span>
              </div>
              {settings.effective.provider === "mistral" && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("model.keySource")}</span>
                  <span className="text-meta">
                    {settings.effective.keyFrom === "workspace"
                      ? t("model.keyFromWorkspace")
                      : settings.effective.keyFrom === "installation"
                        ? t("model.keyFromInstallation")
                        : t("model.keyMissing")}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <Badge className="border-border text-muted-foreground w-fit bg-transparent">
                {t("noModel")}
              </Badge>
              <p className="text-muted-foreground">{t("setupIntro")}</p>
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed">
                {`# .env — EU-hostet (Mistral)\nLLM_PROVIDER=mistral\nMISTRAL_API_KEY=din-nøgle-her\n\n# eller lokalt (Ollama)\nLLM_PROVIDER=ollama\nOLLAMA_BASE_URL=http://localhost:11434`}
              </pre>
              <p className="text-muted-foreground">{t("setupOutro")}</p>
            </div>
          )}
          {/* Configured is not the same as working, and only the
              second one is worth telling somebody. The test spends a real
              model call, so it is offered to the people who own the bill;
              the action checks the same thing again for itself. */}
          {canEdit && <TestConnection />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("model.title")}</CardTitle>
          <CardDescription>{t("model.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ModelForm settings={settings} canEdit={canEdit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("fallbackTitle")}</CardTitle>
          <CardDescription>{t("fallbackBody", { engine: RULES_ENGINE_NAME })}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-col gap-2 text-sm">
          <p>{t("fallbackDetail")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("limitsTitle")}</CardTitle>
          <CardDescription>{t("limitsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("perUser")}</span>
            <span className="font-medium tabular-nums">{MAX_CALLS_PER_USER_PER_HOUR}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("perWorkspace")}</span>
            <span className="font-medium tabular-nums">{MAX_CALLS_PER_WORKSPACE_PER_DAY}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("messageLength")}</span>
            <span className="font-medium tabular-nums">{MAX_CHAT_CHARS}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("principlesTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-col gap-2 text-sm">
          <p>{t("principleDecides")}</p>
          <p>{t("principleUndo")}</p>
          <p>{t("principleData")}</p>
          <p>{t("principleSovereign")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
