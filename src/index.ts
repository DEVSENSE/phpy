#! /usr/bin/env node

import { progress } from './progress';
import { InvalidArgumentError, Option, program } from 'commander';
import { LanguageClient } from './client';
import { CodeStyles, DefaultCodeStyle } from './codestyles';
import { TextDocument } from './textdocument';
import { DefaultMcpServerPort, DefaultPhpVersion } from './consts';
import { Logger } from './logger';

import { StdioForwarder } from './stdio';

async function main(argv: string[]) {

    await program
        .version(require('../package.json').version)
        .name('devsense-php-mcp')
        .description('PHP MCP Server')
        .showHelpAfterError(true)
        .option('-r, --root <path>', 'Root directory, to which are other parameters relative. Current working directory by default.')
        .option('-x, --exclude <path...>', 'Files or directories to be excluded from indexing.')
        .option('-p, --mcp-port <N>', 'Specify the MCP server port number. If --stdio is used without --mcp-port, a random port will be selected.', str => parseInt(str))
        .option('--stdio', 'Communicate with MCP client using standard input and output (STDIO).')
        .argument('[path...]', 'Files or directories to be indexed.')
        .action(async (paths: string[] | undefined, options) => {

            const isStdio = !!options.stdio
            const log = new Logger(true, isStdio)
            const root = options.root ?? process.cwd()

            const port = options.mcpPort ?? (isStdio ? undefined : DefaultMcpServerPort)
            const client = new LanguageClient(log, port)

            let progressBar = isStdio ? undefined : progress()
            const indexing = new Promise(resolve => {
                let onLoadStatus = client.onLoadStatus(status => {
                    if (!status.isLoadPending && !status.pendingAnalysis && !status.pendingParse) {
                        resolve(true)
                    }
                    else if (progressBar) {
                        let total = status.totalFiles * 2
                        let pending = (status.pendingAnalysis ?? 0) + (status.pendingParse ?? 0)
                        progressBar.update(total - pending, total)
                    }
                })
            })

            await client.start(
                root,
                paths ?? ['**/*.php'],
                options.exclude,
                DefaultPhpVersion,
            )

            if (client.MCPServerPort) {
                log.info(`MCP Server running on 127.0.0.1:${client.MCPServerPort} ...`)
            }
            else {
                log.error(new Error('Failed to start MCP Server'))
                await client.exit()
                process.exit(1)
            }

            if (isStdio) {
                const forwarder = new StdioForwarder({
                    port: client.MCPServerPort,
                    onClose: async () => {
                        await client.exit()
                        process.exit(0)
                    }
                })
                forwarder.start()
            }

            //
            await indexing

            // await Ctrl+C to gracefully exit
            if (!isStdio) {
                log.info(`Press Ctrl+C to exit.`)
            }
            process.on('SIGINT', async () => {
                log.info('Received Ctrl+C, exiting...')
                await client.exit()
                process.exit(0)
            })
        })
        .parseAsync(argv)
}

//
main(process.argv)