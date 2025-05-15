import { spawn } from 'child_process';
import { arch, platform } from 'os';
import path from 'path';
import * as rpc from 'vscode-jsonrpc/node';
import { EventEmitter } from './event';
//import { Devsense } from 'devsense-php-ls';

namespace LSP {

    export interface DevsenseLoadStatus { totalFiles: number, pendingParse: number, pendingAnalysis: number, isLoadPending: boolean, }
    export interface Diagnostic { range: any, code: string, message: string, severity: number, }

    export const devsenseLoadStatus = new rpc.NotificationType<DevsenseLoadStatus>('devsense/loadStatus')
    export const initialize = new rpc.RequestType<any, any, any>('initialize')
    export const workspaceDiagnostics = new rpc.RequestType<any, { uri: string, diagnostics: Diagnostic[] }[], any>('workspace/diagnostics')
    export const windowShowMessage = new rpc.NotificationType<{ message: string, type: 1 | 2 | 3 | 4 }>('window/showMessage')
    export const windowLogMessage = new rpc.NotificationType<{ message: string, type: 1 | 2 | 3 | 4 }>('window/logMessage')
    export const telemetryEvent = new rpc.NotificationType<{ event: string, exception: string, stack: string, data: any }>('telemetry/event')
    export const textDocumentPublishDiagnostics = new rpc.NotificationType<{ uri: string, diagnostics: Diagnostic[] }>('textDocument/publishDiagnostics')

}

export class LanguageClient {

    private readonly connection: rpc.MessageConnection

    private initresponse: any

    public onLoadStatus(listener: (e: LSP.DevsenseLoadStatus) => any): Disposable {
        return this.loadStatusEvent.on(listener)
    }

    private readonly loadStatusEvent: EventEmitter<LSP.DevsenseLoadStatus> = new EventEmitter<LSP.DevsenseLoadStatus>()

    public async diagnostics() {
        return await this.connection.sendRequest(LSP.workspaceDiagnostics, null)
    }

    constructor(
    ) {
        //const lspath0 = Devsense.PHP.LS.languageServerPath()
        const lspath = `${__dirname}/../node_modules/devsense-php-ls-${platform()}-${arch()}/dist/devsense.php.ls.exe`
        //const lspath = "C:/Users/jmise/Projects/phptools-vscode/src/Devsense.PHP.LanguageServer/bin/Debug/net9.0/devsense.php.ls.exe"
        const lsprocess = spawn(lspath ?? path.resolve(lspath), [], {
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe', 'pipe']
        })

        lsprocess.stdout.on('data', function (data) {
            //console.log('stdout: ' + data.toString());
        })

        lsprocess.stderr.on('data', function (data) {
            console.error('err: ', data.toString());
        })

        // Use stdin and stdout for communication:
        this.connection = rpc.createMessageConnection(
            new rpc.StreamMessageReader(lsprocess.stdout),
            new rpc.StreamMessageWriter(lsprocess.stdin)
        )
    }

    async start(root: string, include: string[], exclude: string[] | undefined, phpVersion: string = '8.4') {

        this.connection.onNotification(LSP.devsenseLoadStatus, async (args) => {
            this.loadStatusEvent.fire(args)
        })
        this.connection.onNotification(LSP.windowShowMessage, args => {
            console.log(args)
        })
        this.connection.onNotification(LSP.windowLogMessage, args => {
            console.log(args)
        })
        this.connection.onNotification(LSP.telemetryEvent, args => {
        })
        this.connection.onNotification(LSP.textDocumentPublishDiagnostics, args => {
            //this.diagnosticsMap.set(args.uri, args.diagnostics)
        })
        this.connection.onNotification('workspace/codeLens/refresh', args => { })
        this.connection.onNotification('workspace/inlayHint/refresh', args => { })

        //
        this.connection.listen()

        //
        this.initresponse = await this.connection.sendRequest(LSP.initialize, {
            processId: process.pid,
            rootUri: `file://${root}`,
            capabilities: {
            },
            initializationOptions: {
                0: {}, // license
                'clientFeatures': [LSP.devsenseLoadStatus.method],
                'files.associations': { '*.php': 'php' },
                'files.exclude': Object.assign({}, (exclude ?? []).map(e => ({ [e]: true }))), // { 'glob': true }
                'files.insertFinalNewline': true,
                'files.eol': '\n',
                'search.exclude': {},
                'php.codeActions.enabled': false,
                'phpTools.language': 'en',
                'phpTools.heartBeatInterval': 50, // 50ms loadStatus interval
                'php.problems.exclude': {}, // { 'glob': [...ERR_CODEs] }
                'php.problems.scope': 'all',
                'php.stubs': ['all'],
                'php.version': phpVersion,
                'php.workspace.shortOpenTag': false,
                'php.cache.enableOnlineCache': false,
                'php.codeLens.enabled': false,
                'php.sortUses.caseSensitive': false,
                'php.format.codeStyle': 'PSR-12',
            },
        })
    }

    async exit() {
        await this.connection.sendNotification('exit')
        this.connection.end()
    }
}