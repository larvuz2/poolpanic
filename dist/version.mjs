// Which build this is. Netlify writes this file while it builds (stamp-version.mjs), so a crash report names the exact
// commit; from a checkout it says "dev".
export const BUILD = { commit: "dev", context: "local", branch: "", built: "" };
