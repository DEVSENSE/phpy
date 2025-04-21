#! /usr/bin/env node

import { program } from '@commander-js/extra-typings';
import bootsharp, { Project } from "../../Devsense.PHP.CodeAnalysis/bin/bootsharp"
import { Dirent, readFile } from 'fs';
import { Glob, glob } from 'glob';
import { minimatch } from 'minimatch';
import { DefaultConcurrency, showProgress } from './progress';

async function globHelper(cwd: string, globs: string[], ignore: string[] | undefined, log: Logger, callback: (fullpath: string) => void) {
    const g = new Glob(
        globs,
        {
            cwd: cwd,
            withFileTypes: true,
            ignore: ignore
        }
    )

    for await (const ent of g.iterate()) {
        if (ent.isFile()) {
            callback(ent.fullpath())
        }
    }
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

async function addFileToProject(path: string, log: Logger) {
    await new Promise((resolve, reject) => {
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
        .version('0.0.2')
        .name('phpy')
        .description('PHP Code Analysis Tool')
        .showHelpAfterError(true)
        .option('-r, --root <path>', 'Root directory, to which are other parameters relative. Current working directory by default.')
        .option('-i, --include <path...>', 'Files or directories (including sub-directories) to be indexed.', ['.'])
        .option('-x, --exclude <path...>', 'Files or directories to be excluded from indexing.')
        .option('-c, --concurrency <N>', 'Number of files being read in parallel.', str => parseInt(str), DefaultConcurrency)
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
            let readPromises: Promise<unknown>[] = []
            let allFiles: string[] = []

            await globHelper(
                root,
                (options.include ?? ['.']).flatMap(path => [path, `${path}/**/*.php`, `${path}/**/*.phar`]),
                options.exclude,
                log,
                fpath => {
                    allFiles.push(fpath)
                }
            )

            await showProgress(allFiles.map(fpath => () => addFileToProject(fpath, log)), options.concurrency)

            //

            const filesToAnalyze = !paths || paths.length == 0 || (paths.length == 1 && paths[0] == '**/*')
                ? allFiles
                : allFiles.filter(
                    fpath => paths.filter(
                        pattern => minimatch(fpath, pattern, {})
                    ).length // any()
                )

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