import { openUrl } from "@tauri-apps/plugin-opener";
import { APP_VERSION } from "@/lib/version";

/** Public GitHub release feed — no auth, no app secrets. */
export const GITHUB_REPO = "foxinal-team/foxinal-app";
export const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases`;

const LAST_CHECK_KEY = "foxinal-update-last-check";
const SKIPPED_VERSION_KEY = "foxinal-update-skipped";
const THROTTLE_MS = 24 * 60 * 60 * 1000;

export type LatestRelease = {
  version: string;
  tagName: string;
  htmlUrl: string;
  name: string | null;
};

export type UpdateCheckResult =
  | { status: "throttled" }
  | { status: "up-to-date"; current: string; latest: LatestRelease }
  | {
      status: "available";
      current: string;
      latest: LatestRelease;
      skipped: boolean;
    }
  | { status: "error"; error: string };

type GithubLatestRelease = {
  tag_name?: string;
  html_url?: string;
  name?: string | null;
  draft?: boolean;
  prerelease?: boolean;
};

/** Strip a leading `v` and compare dotted numeric segments (semver-ish). */
export function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, "");
}

export function compareSemver(a: string, b: string): number {
  const pa = normalizeVersion(a)
    .split(/[.+-]/)
    .map((part) => {
      const n = Number.parseInt(part, 10);
      return Number.isFinite(n) ? n : 0;
    });
  const pb = normalizeVersion(b)
    .split(/[.+-]/)
    .map((part) => {
      const n = Number.parseInt(part, 10);
      return Number.isFinite(n) ? n : 0;
    });
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export function isNewerVersion(remote: string, local: string): boolean {
  return compareSemver(remote, local) > 0;
}

export function getSkippedVersion(): string | null {
  try {
    const value = localStorage.getItem(SKIPPED_VERSION_KEY);
    return value?.trim() ? normalizeVersion(value) : null;
  } catch {
    return null;
  }
}

export function skipVersion(version: string): void {
  try {
    localStorage.setItem(SKIPPED_VERSION_KEY, normalizeVersion(version));
  } catch {
    // ignore quota / private mode
  }
}

export function clearSkippedVersion(): void {
  try {
    localStorage.removeItem(SKIPPED_VERSION_KEY);
  } catch {
    // ignore
  }
}

export function shouldCheckForUpdates(now = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return true;
    const last = Date.parse(raw);
    if (!Number.isFinite(last)) return true;
    return now - last >= THROTTLE_MS;
  } catch {
    return true;
  }
}

function markChecked(now = Date.now()): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, new Date(now).toISOString());
  } catch {
    // ignore
  }
}

export async function fetchLatestRelease(): Promise<LatestRelease> {
  const response = await fetch(LATEST_RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (response.status === 404) {
    throw new Error("No published releases found yet.");
  }
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status}. Try again later.`);
  }

  const data = (await response.json()) as GithubLatestRelease;
  if (data.draft) {
    throw new Error("Latest release is still a draft.");
  }
  const tagName = data.tag_name?.trim();
  if (!tagName) {
    throw new Error("Release response was missing a version tag.");
  }

  return {
    version: normalizeVersion(tagName),
    tagName,
    htmlUrl: data.html_url?.trim() || `${RELEASES_PAGE_URL}/tag/${tagName}`,
    name: data.name ?? null,
  };
}

/**
 * Fetch latest GitHub release and compare to the running app version.
 * Only public release metadata is requested — never inventory or credentials.
 */
export async function checkForUpdates(options?: {
  /** When true, always hit the network (Settings manual check). */
  force?: boolean;
  currentVersion?: string;
}): Promise<UpdateCheckResult> {
  const force = options?.force === true;
  const current = normalizeVersion(options?.currentVersion ?? APP_VERSION);

  if (!force && !shouldCheckForUpdates()) {
    return { status: "throttled" };
  }

  try {
    const latest = await fetchLatestRelease();
    markChecked();

    if (!isNewerVersion(latest.version, current)) {
      return { status: "up-to-date", current, latest };
    }

    const skipped = getSkippedVersion() === latest.version;
    return { status: "available", current, latest, skipped };
  } catch (err) {
    if (force) {
      // Manual checks still record the attempt so we don't hammer GitHub.
      markChecked();
    }
    const message =
      err instanceof Error && err.message.trim()
        ? err.message
        : "Could not check for updates.";
    return { status: "error", error: message };
  }
}

export async function openReleasePage(url: string): Promise<void> {
  const target = url.trim() || RELEASES_PAGE_URL;
  await openUrl(target);
}
