#! /usr/bin/env node

import { program } from '@commander-js/extra-typings';
import bootsharp, { Project } from "../../Devsense.PHP.CodeAnalysis/bin/bootsharp"
import { readFile, readFileSync } from 'fs';
import { glob } from 'glob';

// bootsharp.boot().then(() => {
//     //console.log(Program.getBackendName());
//     console.log('helo')
// })

async function globFiles(cwd: string, globs: string[], log: Logger): Promise<string[]> {
    return (await glob(
        globs,
        {
            cwd: cwd,
            withFileTypes: true
        }
    ))
        .filter(file => file.isFile())
        .map(file => file.fullpath())
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

function addFileToProject(path: string, log: Logger) {
    return new Promise((resolve, reject) => {
        readFile(path, (err, data) => {
            if (err) {
                log.error(err)
                reject(err)
            }
            else {
                Project.addFile(path, data.toString('utf-8'))
                resolve(true)
            }
        })
    })
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
        .action(async (paths: string[] | undefined, options) => {

            //
            const log = new Logger(options.verbose == true)
            const root = options.root ?? process.cwd()

            log.info(`Starting ...`)

            await bootsharp.boot({})
            await Project.initialize(root)

            log.info(`Reading files ...`)

            //
            let readPromises = []
            let allFiles = []
            for (const fpath of await globFiles(
                root,
                (options.include ?? ['.']).flatMap(path => [path, `${path}/**/*.php`]),
                log)) {

                allFiles.push(fpath)
                readPromises.push(addFileToProject(fpath, log))
            }
            await Promise.all(readPromises)

            log.info(`${allFiles.length} file(s) parsed.`)

            //

            const filesToAnalyze = !paths || paths.length == 0 || (paths.length == 1 && paths[0] == '**/*.php')
                ? allFiles
                : await globFiles(
                    root,
                    (paths ?? ['**/*.php']).flatMap(path => [path, `${path}/**/*.php`]),
                    log
                )

            if (options.exclude) {
                log.notimplemented('exclude')
            }

            //log.info(`Analyzing ${filesToAnalyze.length} file(s) ...`)
            for (const fpath of filesToAnalyze) {
                //log.info(`Analyzing ${fpath} ...`)
                Project.analyseFile(fpath)
            }

            log.info(`Done.`)
            process.exit(0)
        })
        .parseAsync(argv)
}

//
main(process.argv)