import { redirect } from "next/navigation";
import { AuthError, requireAdmin } from "@/server/auth";
import { LlmManager } from "./llm-manager";

export default async function LlmSettingsPage() {
  try {
    await requireAdmin(["owner"]);
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/admin/login");
    if (error instanceof AuthError) redirect("/admin");
    throw error;
  }
  return <LlmManager />;
}
