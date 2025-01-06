#!/usr/bin/env node
import { program } from "commander";
import pkg from "../package.json";
import { applyCommand } from "./commands/apply";
import { getCommand } from "./commands/get";
import { deleteCommand } from "./commands/delete";
import { resetCommand } from "./commands/reset";

program.addCommand(applyCommand);
program.addCommand(getCommand);
program.addCommand(deleteCommand);
program.addCommand(resetCommand);

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
program.version(pkg.version).parse(process.argv);
