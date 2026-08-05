export type HealthPayload = {
  status: "ok";
  database: "connected";
  commitSha: string;
};

export function getCommitSha(
  environment: Record<string, string | undefined> = process.env,
) {
  return (
    environment.VERCEL_GIT_COMMIT_SHA ??
    environment.GIT_COMMIT_SHA ??
    "local"
  );
}

export function createHealthPayload(commitSha: string): HealthPayload {
  return {
    status: "ok",
    database: "connected",
    commitSha,
  };
}
