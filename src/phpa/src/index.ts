#! /usr/bin/env node

import { program } from "commander";
import bootsharp, { Program } from "../../Devsense.PHP.CodeAnalysis/bin/bootsharp/"

// bootsharp.boot().then(() => {
//     console.log(Program.getBackendName());
// })
program
    .version('1.0.0')
    .description('PHP Code Analysis Tool')
    .parse(process.argv)

const options = program.opts()

if (process.argv.length <= 2) {
    program.outputHelp();
}