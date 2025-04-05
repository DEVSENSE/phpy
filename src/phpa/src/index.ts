#! /usr/bin/env node

import { program } from '@commander-js/extra-typings';
import bootsharp, { Program } from "../../Devsense.PHP.CodeAnalysis/bin/bootsharp"
//import { glob } from 'fs';

// bootsharp.boot().then(() => {
//     //console.log(Program.getBackendName());
//     console.log('helo')
// })

async function main(argv: string[]) {

    await program
        .version('1.0.0')
        .name('phpa')
        .description('PHP Code Analysis Tool')
        .showHelpAfterError(true)
        .option('-i, --include <path...>', 'File or directory (including sub-directories) to be indexed.', ['.'])
        .option('-x, --exclude <path...>', 'Files or directories to be excluded from indexing.')
        .argument('[path...]', 'Files or directories to be analyzed.', ['**/*.php'])
        .action(async (paths, options) => {

            //
            const files = new Set<string>()

            options.include.forEach(path => {
                // glob(path, (err, matches) => {
                //     matches.forEach(value => files.add(value))
                // })
            })

            await bootsharp.boot({})

            //console.log('done')
            
            Program.analyze()
        })
        .parseAsync(argv)
}

//
main(process.argv)