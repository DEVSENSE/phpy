#! /usr/bin/env node

import { progress } from './progress';
import { program } from 'commander';
import { LanguageClient } from './client';

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
        .version('0.1.0')
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

            let progressBar = progress()
            const indexing = new Promise(resolve => {
                let onLoadStatus = client.onLoadStatus(status => {
                    if (!status.isLoadPending && !status.pendingAnalysis && !status.pendingParse) {
                        resolve(true)
                    }
                    else {
                        let total = status.totalFiles * 2
                        let pending = (status.pendingAnalysis ?? 0) + (status.pendingParse ?? 0)
                        progressBar.update(total - pending, total)
                    }
                })
            })

            await client.start(root, options.include, options.exclude, '8.4')
            await indexing

            //
            let diagnostics = await client.diagnostics()

            progressBar.dispose() // remove progress bar

            for (const b of diagnostics) {
                for (const d of b.diagnostics)
                    console.log(`${b.uri}(${d.range.start.line + 1}, ${d.range.start.character + 1}): ${d.message}`)

            }

            await client.exit()
            process.exit(0)
        })
        .parseAsync(argv)
}

//
main(process.argv)