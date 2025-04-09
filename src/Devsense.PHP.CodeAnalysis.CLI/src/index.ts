#! /usr/bin/env node

import { program } from '@commander-js/extra-typings';
import bootsharp, { Program } from "../../Devsense.PHP.CodeAnalysis/bin/bootsharp"
import { glob, readFileSync } from 'fs';

// bootsharp.boot().then(() => {
//     //console.log(Program.getBackendName());
//     console.log('helo')
// })

async function globFiles(cwd: string, globs: string[], log: Logger): Promise<string[]> {
    return await new Promise((resolve, reject) => {
        glob( // it's async
            globs,
            { cwd: cwd, },
            (err, matches) => {
                if (err) {
                    log.error(err)
                    reject(err)
                }

                resolve(matches)
            }
        )
    })
}

async function readFiles(cwd: string, globs: string[], log: Logger): Promise<Record<string, string>> {

    let files = await globFiles(cwd, globs, log)
    let contents: Record<string, string> = {}

    //
    files.forEach(path => {
        try {
            contents[path] = readFileSync(path).toString('utf8') // TODO async
        }
        catch (e) {
            log.error(<Error>e)
        }
    })

    //
    return contents
}

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
        .version('1.0.0')
        .name('phpy')
        .description('PHP Code Analysis Tool')
        .showHelpAfterError(true)
        .option('-r, --root <path>', 'Root directory, to which are other parameters relative. Current working directory by default.')
        .option('-i, --include <path...>', 'Files or directories (including sub-directories) to be indexed.', ['.'])
        .option('-x, --exclude <path...>', 'Files or directories to be excluded from indexing.')
        .option('--verbose', 'Enable verbose output.')
        .argument('[path...]', 'Files or directories to be analyzed.')
        .action(async (paths: string[]|undefined, options) => {

            //
            const log = new Logger(options.verbose == true)
            const root = options.root ?? process.cwd()
            const included = await readFiles(
                root,
                (options.include ?? ['.']).flatMap(path => [path, `${path}/**/*.php`]),
                log
            )
            const files = !paths || paths.length == 0 || (paths.length == 1 && paths[0] == '**/*.php')
                ? Object.keys(included)
                : await globFiles(
                    root,
                    (paths ?? ['**/*.php']).flatMap(path => [path, `${path}/**/*.php`]),
                    log
                )

            if (options.exclude) {
                log.notimplemented('exclude')
            }

            await bootsharp.boot({})

            log.info(`Indexing ${Object.keys(included).length} file(s) ...`)

            //console.log('done')

            await Program.analyze(root, included, files)

            log.info(`Done.`)
        })
        .parseAsync(argv)
}

//
main(process.argv)