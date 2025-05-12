#! /usr/bin/env node

import { Dirent, readFile } from 'fs';
import { Glob, glob } from 'glob';
import { minimatch } from 'minimatch';
import { progress } from './progress';
import { Devsense } from 'devsense-php-ls';
import { spawn } from 'child_process';
import { program } from 'commander';
import { arch, platform } from 'os';
import path from 'path';
import * as rpc from 'vscode-jsonrpc/node';
import { LanguageClient } from './client';


// async function globHelper(cwd: string, globs: string[], ignore: string[] | undefined, log: Logger, callback: (fullpath: string) => void) {
//     const g = new Glob(
//         globs,
//         {
//             cwd: cwd,
//             withFileTypes: true,
//             ignore: ignore
//         }
//     )

//     for await (const ent of g.iterate()) {
//         if (ent.isFile()) {
//             callback(ent.fullpath())
//         }
//     }
// }

class Logger {
    constructor(
        private readonly verbose: boolean
    ) {
    }

    notimplemented(what: string) {
        process.stderr.write(`${what} is not implemented\n`)
    }

    info(text: string) {
        if (this.verbose) {
            process.stdout.write(`${text}\n`)
        }
    }

    error(err: Error) {
        if (err && err.message) {
            process.stderr.write(`${err.message}\n`)
        }
    }
}

async function main(argv: string[]) {

    await program
        .version('0.0.3')
        .name('phpy')
        .description('PHP Code Analysis Tool')
        .showHelpAfterError(true)
        .option('-r, --root <path>', 'Root directory, to which are other parameters relative. Current working directory by default.')
        //.option('-i, --include <path...>', 'Files or directories (including sub-directories) to be indexed.', ['.'])
        .option('-x, --exclude <path...>', 'Files or directories to be excluded from indexing.')
        //.option('-c, --concurrency <N>', 'Number of files being read in parallel.', str => parseInt(str), DefaultConcurrency)
        //.option('--encoding <enc>', 'Encoding used for source files.', str => <BufferEncoding>str, 'utf-8')
        .option('--verbose', 'Enable verbose output.')
        .argument('[path...]', 'Files or directories to be analyzed.')
        .action(async (paths: string[] | undefined, options) => {

            //
            const log = new Logger(options.verbose == true)
            const root = options.root ?? process.cwd()

            log.info(`Starting ...`)

            const client = new LanguageClient()

            const indexing = new Promise(resolve => {
                let loadingProgressBar = progress()
                client.onLoadStatus(status => {
                    if (status.isLoadPending == false && status.pendingAnalysis == 0 && status.pendingParse == 0) {
                        loadingProgressBar.done()
                        resolve(true)
                    }
                    else {
                        loadingProgressBar.update(
                            status.totalFiles - Math.max(status.pendingAnalysis, status.pendingParse),
                            status.totalFiles
                        )
                    }
                })
            })

            await client.start(root, options.include, options.exclude, '8.4')
            await indexing
            await client.loaded

            // output diagnostics
            client.diagnostics.forEach((diagnostics, file) => {
                if (diagnostics) {
                    diagnostics.forEach(diagnostic => {
                        console.log(`${file}(${diagnostic.range.start.line + 1}, ${diagnostic.range.start.character + 1}): ${diagnostic.message}`)
                    })
                }
            })

            //
            log.info(`Done.`)
            await client.exit()
            process.exit(0)
        })
        .parseAsync(argv)
}

//
main([...process.argv, '-r', 'D:/Documents/Projects/wpdotnet-sdk/wordpress/'])