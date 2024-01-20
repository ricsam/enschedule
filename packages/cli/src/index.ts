#!/usr/bin/env node
import { program } from "commander"; // add this line
import { applyCommand } from "./commands/apply";
import { getCommand } from "./commands/get";

program.addCommand(applyCommand);
program.addCommand(getCommand);

program.parse(process.argv);
