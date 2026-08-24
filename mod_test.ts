import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  assetName,
  cachePath,
  latestTag,
  releaseAssetUrl,
  splitPinnedTag,
  targetTriple,
} from "./mod.ts";

Deno.test("maps deno platforms onto published rust targets", async () => {
  const cases: Array<[string, string, string]> = [
    ["linux", "x86_64", "x86_64-unknown-linux-gnu"],
    ["linux", "aarch64", "aarch64-unknown-linux-gnu"],
    ["darwin", "x86_64", "x86_64-apple-darwin"],
    ["darwin", "aarch64", "aarch64-apple-darwin"],
    ["windows", "x86_64", "x86_64-pc-windows-msvc"],
  ];
  for (const [os, arch, expected] of cases) {
    assertEquals(targetTriple(os, arch), expected);
  }
  assertThrows(() => targetTriple("sunos", "sparc"));
});

Deno.test("asset names carry .exe only on windows targets", () => {
  const actual = [
    assetName("x86_64-unknown-linux-gnu"),
    assetName("x86_64-pc-windows-msvc"),
  ];
  const expected = [
    "aimee-x86_64-unknown-linux-gnu",
    "aimee-x86_64-pc-windows-msvc.exe",
  ];
  assertEquals(actual, expected);
});

Deno.test("release urls point at the github download for the tag", () => {
  const actual = releaseAssetUrl("v0.1.0", "aarch64-apple-darwin");
  const expected =
    "https://github.com/swcstudiospace/aimeecodes/releases/download/v0.1.0/aimee-aarch64-apple-darwin";
  assertEquals(actual, expected);
});

Deno.test("pinned tag is split from passthrough args", () => {
  const pinned = splitPinnedTag(["v0.2.1", "--version"]);
  const expectedPinned = { tag: "v0.2.1", args: ["--version"] };
  assertEquals(pinned, expectedPinned);

  const unpinned = splitPinnedTag(["chat"]);
  const expectedUnpinned = { args: ["chat"] };
  assertEquals(unpinned, expectedUnpinned);
});

Deno.test("cache path is versioned per tag", () => {
  assertEquals(
    cachePath("v0.1.0", "/home/dev/.aimee", "linux"),
    "/home/dev/.aimee/bin/aimee-v0.1.0",
  );
  assertEquals(
    cachePath("v0.1.0", "C:/Users/dev/.aimee", "windows"),
    "C:/Users/dev/.aimee/bin/aimee-v0.1.0.exe",
  );
});

Deno.test("latest tag rejects api failures", async () => {
  // Non-existent repo must surface a clean error instead of undefined.
  await assertRejects(() => latestTag("swcstudiospace/does-not-exist-404"));
});
