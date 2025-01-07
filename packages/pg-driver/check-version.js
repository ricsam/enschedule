const fs = require("node:fs");
const path = require("node:path");

// Paths to the files
const packageJsonPath = path.join(__dirname, "package.json");
const versionTsPath = path.join(__dirname, "version.ts");

try {
  // Read and parse package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const packageVersion = packageJson.version;

  // Read version.ts
  const versionTsContent = fs.readFileSync(versionTsPath, "utf8");

  // Extract the version string from version.ts
  const versionTsMatch = versionTsContent.match(/version\s*=\s*"(?<value>[\d.]+)"/);
  if (!versionTsMatch) {
    throw new Error("Could not find a version in version.ts");
  }
  const versionTsVersion = versionTsMatch.groups.value;

  // Compare the versions
  if (packageVersion === versionTsVersion) {
    console.log(`Versions match: ${packageVersion}`);
  } else {
    console.error("Version mismatch!");
    console.error(`package.json version: ${packageVersion}`);
    console.error(`version.ts version: ${versionTsVersion}`);
    process.exit(1);
  }
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
