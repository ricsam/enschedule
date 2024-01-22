#!/usr/bin/env node
import { program } from "commander"; // add this line
import { applyCommand } from "./commands/apply";
import { getCommand } from "./commands/get";
import { deleteCommand } from "./commands/delete";

program.addCommand(applyCommand);
program.addCommand(getCommand);
program.addCommand(deleteCommand);

program.parse(process.argv);
