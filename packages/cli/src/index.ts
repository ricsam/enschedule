#!/usr/bin/env node
import { program } from "commander"; // add this line
import { applyCommand } from "./commands/apply";

program.addCommand(applyCommand);

program.parse(process.argv);
