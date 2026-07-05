// Dispatches the ingest-daily GitHub Actions workflow so manual runs triggered
// from the admin console actually execute the ingestion worker.

interface DispatchConfig { token: string; repository: string; ref: string; workflow: string }

export function githubDispatchConfig(env: NodeJS.ProcessEnv = process.env): DispatchConfig | null {
  const token = env.GITHUB_TOKEN?.trim();
  const repository = env.GITHUB_REPOSITORY?.trim();
  if (!token || !repository) return null;
  return { token, repository, ref: env.GITHUB_WORKFLOW_REF?.trim() || "main", workflow: env.GITHUB_WORKFLOW_FILE?.trim() || "ingest-daily.yml" };
}

export async function dispatchIngestWorkflow(runId: string, config = githubDispatchConfig()): Promise<void> {
  if (!config) throw new Error("WORKFLOW_DISPATCH_NOT_CONFIGURED");
  const response = await fetch(`https://api.github.com/repos/${config.repository}/actions/workflows/${config.workflow}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: config.ref, inputs: { run_id: runId } }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`workflow dispatch failed: ${response.status} ${detail.slice(0, 500)}`);
    throw new Error("WORKFLOW_DISPATCH_FAILED");
  }
}
