/**
 * Deno launcher for the Aimee Codes CLI.
 *
 * Downloads the platform binary from GitHub Releases on first run, caches
 * it under `AIMEE_HOME` (default `~/.aimee`), then execs it with the given
 * arguments.
 *
 * Usage:
 *   deno run -A jsr:@swcstudiospace/aimee            # latest release
 *   deno run -A jsr:@swcstudiospace/aimee v0.1.0 ... # pinned tag + args
 */

export const GITHUB_REPO = "swcstudiospace/aimeecodes";

/** Maps Deno platform/arch onto the Rust target triples published by CI. */
export function targetTriple(os: string, arch: string): string {
  const pair = `${arch}-${os}`;
  switch (pair) {
    case "x86_64-linux":
      return "x86_64-unknown-linux-gnu";
    case "aarch64-linux":
      return "aarch64-unknown-linux-gnu";
    case "x86_64-darwin":
      return "x86_64-apple-darwin";
    case "aarch64-darwin":
      return "aarch64-apple-darwin";
    case "x86_64-windows":
      return "x86_64-pc-windows-msvc";
    default:
      throw new Error(`Unsupported platform: ${pair}`);
  }
}

/** Release asset filename for a target triple (matches release.yml). */
export function assetName(target: string): string {
  return target.includes("windows") ? `aimee-${target}.exe` : `aimee-${target}`;
}

/** GitHub Releases download URL for a tagged binary. */
export function releaseAssetUrl(tag: string, target: string): string {
  return `https://github.com/${GITHUB_REPO}/releases/download/${tag}/${
    assetName(target)
  }`;
}

/**
 * Splits launcher argv into an optional pinned tag (first arg matching
 * `v<major>…`) and the remaining args passed through to the CLI.
 */
export function splitPinnedTag(
  argv: readonly string[],
): { tag?: string; args: string[] } {
  if (argv.length > 0 && /^v\d/.test(argv[0])) {
    return { tag: argv[0], args: argv.slice(1) };
  }
  return { args: [...argv] };
}

/** Local cache path for a tagged binary. */
export function cachePath(tag: string, home: string, os: string): string {
  const exe = os === "windows" ? ".exe" : "";
  return `${home}/bin/aimee-${tag}${exe}`;
}

/** Latest published release tag from the GitHub API. */
export async function latestTag(repo: string = GITHUB_REPO): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/releases/latest`,
  );
  if (!res.ok) {
    throw new Error(`Failed to resolve latest release (${res.status})`);
  }
  const body = await res.json();
  const tag = body?.tag_name;
  if (typeof tag !== "string" || tag.length === 0) {
    throw new Error("Release metadata did not contain a tag_name");
  }
  return tag;
}

/** Returns the cached binary path, downloading it on first use. */
export async function ensureBinary(
  tag: string,
  os: string,
  home: string,
): Promise<string> {
  const dest = cachePath(tag, home, os);
  try {
    await Deno.stat(dest);
    return dest;
  } catch {
    // Not cached yet — fall through to download.
  }
  const url = releaseAssetUrl(tag, targetTriple(os, Deno.build.arch));
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  await Deno.mkdir(`${home}/bin`, { recursive: true });
  await Deno.writeFile(dest, res.body);
  if (os !== "windows") {
    await Deno.chmod(dest, 0o755);
  }
  return dest;
}

/** Resolves the binary and execs it; returns its exit code. */
export async function main(
  argv: readonly string[] = Deno.args,
): Promise<number> {
  const { tag, args } = splitPinnedTag(argv);
  const resolved = tag ?? await latestTag();
  const home = Deno.env.get("AIMEE_HOME") ??
    `${Deno.env.get("HOME") ?? "."}/.aimee`;
  const bin = await ensureBinary(resolved, Deno.build.os, home);
  const child = new Deno.Command(bin, {
    args,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await child.spawn().status;
  return status.code;
}

if (import.meta.main) {
  Deno.exit(await main());
}
