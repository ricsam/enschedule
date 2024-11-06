#!/usr/bin/env node
import { program } from "commander"; // add this line
import { applyCommand } from "./commands/apply";
import { getCommand } from "./commands/get";
import { deleteCommand } from "./commands/delete";
import pkg from "../package.json";
import { resetCommand } from "./commands/reset";

program.addCommand(applyCommand);
program.addCommand(getCommand);
program.addCommand(deleteCommand);
program.addCommand(resetCommand);

program.version(pkg.version).parse(process.argv);
