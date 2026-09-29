// Writes dist/version.mjs from Netlify's build environment so a crash report names the commit it came from. Runs
// before the checks in the Netlify build (see netlify.toml); anywhere else it leaves the "dev" file alone, and it
// never fails a build.
import { writeFileSync } from "node:fs";

try {
  const env = process.env;
  if (env.COMMIT_REF) {
    const build = {
      commit: env.COMMIT_REF.slice(0, 7),
      context: env.CONTEXT || "",
      branch: env.HEAD || env.BRANCH || "",
      built: new Date().toISOString().slice(0, 16).replace("T", " ") + "Z",
    };
    if (env.REVIEW_ID) build.pr = Number(env.REVIEW_ID) || 0;
    writeFileSync(
      new URL("./dist/version.mjs", import.meta.url),
      "// Written by stamp-version.mjs during the Netlify build.\nexport const BUILD = " +
        JSON.stringify(build) +
        ";\n",
    );
    console.log("Stamped dist/version.mjs:", JSON.stringify(build));
  } else console.log("No COMMIT_REF: dist/version.mjs stays as it is.");
} catch (e) {
  console.warn("stamp-version: skipped (" + e.message + ")");
}
