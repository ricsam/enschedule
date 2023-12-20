#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Function to modify package.json file
function modifyPackageJson(packagePath) {
  const packageJsonPath = path.join(packagePath, "package.json");
  let packageJson = require(packageJsonPath);

  packageJson.main = "./dist/index.js";
  packageJson.types = "./dist/index.d.ts";

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

function main() {
  try {
    // List of packages
    const packages = ["worker-api", "types", "worker", "pg-driver", "hub"];

    // Modify package.json for each package
    packages.forEach((pkg) => {
      const packagePath = path.join(__dirname, "packages", pkg);
      modifyPackageJson(packagePath);
    });
  } catch (error) {
    console.error("An error occurred:", error);
    process.exit(1);
  }
}

main();
