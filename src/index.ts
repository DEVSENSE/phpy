#! /usr/bin/env node

import { Dirent, readFile } from 'fs';
import { Glob, glob } from 'glob';
import { minimatch } from 'minimatch';
import { DefaultConcurrency, showProgress } from './progress';
import { Devsense } from 'devsense-php-ls';
import { spawn } from 'child_process';
import { program } from 'commander';
import { arch, platform } from 'os';
import path from 'path';
import * as rpc from 'vscode-jsonrpc/node';


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
        .option('-i, --include <path...>', 'Files or directories (including sub-directories) to be indexed.', ['.'])
        .option('-x, --exclude <path...>', 'Files or directories to be excluded from indexing.')
        .option('-c, --concurrency <N>', 'Number of files being read in parallel.', str => parseInt(str), DefaultConcurrency)
        .option('--encoding <enc>', 'Encoding used for source files.', str => <BufferEncoding>str, 'utf-8')
        .option('--verbose', 'Enable verbose output.')
        .argument('[path...]', 'Files or directories to be analyzed.')
        .action(async (paths: string[] | undefined, options) => {

            //
            const log = new Logger(options.verbose == true)
            const root = options.root ?? process.cwd()

            log.info(`Starting ...`)

            //const lspath = Devsense.PHP.LS.languageServerPath()
            const lspath = `node_modules/devsense-php-ls-${platform()}-${arch()}/dist/devsense.php.ls.exe`
            const lsprocess = spawn(path.resolve(lspath), [], {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe', 'pipe']
            });

            lsprocess.stdout.on('data', function (data) {
                //Here is where the output goes
                console.log('stdout: ' + data.toString());
            });

            lsprocess.stderr.on('data', function (data) {
                console.error('err: ', data.toString());
            });

            // Use stdin and stdout for communication:
            let connection = rpc.createMessageConnection(
                new rpc.StreamMessageReader(lsprocess.stdout),
                new rpc.StreamMessageWriter(lsprocess.stdin)
            );

            //let notification = new rpc.NotificationType<string>('testNotification');

            connection.listen();

            //connection.sendNotification(notification, 'Hello World');

            let load = new Promise(resolve => {

                connection.onNotification("devsense/loadStatus", args => {
                    console.log(args)
                    resolve(false)
                });

            })

            let init = await connection.sendRequest("initialize", {
                processId: process.pid,
                rootUri: `file://${root}`,
                capabilities: {
                },
                initializationOptions: {

                },
                rootPath: root,
            })

            await load

            //
            log.info(`Done.`)
            await connection.sendNotification('exit')
            connection.end()
            process.exit(0)
        })
        .parseAsync(argv)
}

//
main(process.argv)