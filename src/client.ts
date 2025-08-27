import { spawn } from 'child_process';
import path from 'path';
import * as rpc from 'vscode-jsonrpc/node';
import { EventEmitter } from './event';
import * as DevsenseNode from 'devsense-php-ls-node';
import * as DevsenseLS from 'devsense-php-ls';

import LS = DevsenseLS.Devsense.PHP.LS;
import LSP1 = DevsenseNode.Devsense.LanguageServer.Protocol

import { DefaultCodeStyle } from './codestyles';
import { TextDocument } from './textdocument';

export namespace LSP {

    export interface LoadStatusParams { totalFiles: number, pendingParse: number, pendingAnalysis: number, isLoadPending: boolean, }

    export interface Position { line: number, character: number }
    export interface Range { start: Position, end: Position }
    export interface TextEdit { range: Range, newText: string }
    export interface Diagnostic { range: Range, code: string, message: string, severity: number, }
    export interface TextDocumentIdentifier { uri: string }
    export interface TextDocumentItem extends TextDocumentIdentifier { languageId: string, version: number, text: string, }
    export interface DocumentRangeFormattingParams { textDocument: TextDocumentIdentifier, range: Range, options?: { tabSize: number, insertSpaces: boolean, trimTrailingWhitespace?: boolean, insertFinalNewline?: boolean, trimFinalNewlines?: boolean } }
    export interface PhpDocumentRangeFormattingParams extends DocumentRangeFormattingParams { htmlEdits: TextEdit[] }

    export const devsenseLoadStatus = new rpc.NotificationType<LoadStatusParams>('devsense/loadStatus')
    export const devsenseRangeFormat = new rpc.RequestType<PhpDocumentRangeFormattingParams, TextEdit[], any>('devsense/phpRangeFormatting')

    export const initialize = new rpc.RequestType<any, any, any>('initialize')
    export const workspaceDiagnostics = new rpc.RequestType<any, { uri: string, diagnostics: Diagnostic[] }[], any>('workspace/diagnostics')
    export const windowShowMessage = new rpc.NotificationType<{ message: string, type: 1 | 2 | 3 | 4 }>('window/showMessage')
    export const windowLogMessage = new rpc.NotificationType<{ message: string, type: 1 | 2 | 3 | 4 }>('window/logMessage')
    export const telemetryEvent = new rpc.NotificationType<{ event: string, exception: string, stack: string, data: any }>('telemetry/event')
    export const textDocumentPublishDiagnostics = new rpc.NotificationType<{ uri: string, diagnostics: Diagnostic[] }>('textDocument/publishDiagnostics')
    export const textDocumentDidOpen = new rpc.NotificationType<{ textDocument: TextDocumentItem }>('textDocument/didOpen')
    export const textDocumentDidClose = new rpc.NotificationType<{ textDocument: TextDocumentItem }>('textDocument/didClose')

}

namespace Convert {
    export function toTextDocumentItem(doc: TextDocument) {
        return {
            uri: doc.uri,
            languageId: doc.langId,
            version: 0,
            text: doc.content
        }
    }
}

export class LanguageClient {

    private readonly connection: rpc.MessageConnection

    private initresponse: any

    private readonly documents = new Map<string, TextDocument>()

    public onLoadStatus(listener: (e: LSP.LoadStatusParams) => any): Disposable {
        return this.loadStatusEvent.on(listener)
    }

    private readonly loadStatusEvent: EventEmitter<LSP.LoadStatusParams> = new EventEmitter<LSP.LoadStatusParams>()

    public async diagnostics() {
        return await this.connection.sendRequest(LSP.workspaceDiagnostics, null)
    }

    public async listDocuments()/*: Promise<TextDocumentIdentifier[]>*/ {
        return await this.connection.sendRequest(LSP1.devsenseListProjectFiles, null)
    }

    public async openDocument(uri: string, langId: 'php'): Promise<TextDocument> {
        var doc = TextDocument.fromUri(uri, langId)
        
        await this.connection.sendNotification(LSP.textDocumentDidOpen, {
            textDocument: Convert.toTextDocumentItem(doc)
        })

        this.documents.set(doc.uri, doc)

        //
        return doc
    }

    public async closeDocument(uri: string) {
        var doc = this.documents.get(uri)
        if (doc == undefined)
            return;

        await this.connection.sendNotification(LSP.textDocumentDidClose, {
            textDocument: Convert.toTextDocumentItem(doc)
        })

        this.documents.delete(doc.uri)

        //
        return doc
    }

    public async rangeFormat(doc: TextDocument, range?: LSP.Range, htmlEdits?: LSP.TextEdit[]): Promise<TextDocument> {

        const p: LSP.PhpDocumentRangeFormattingParams = {
            htmlEdits: htmlEdits ?? [],
            textDocument: { uri: doc.uri },
            range: range ?? {
                start: { line: 0, character: 0 },
                end: { line: doc.lineCount - 1, character: Number.MAX_SAFE_INTEGER }
            }
        }

        //
        let edits = await this.connection.sendRequest(LSP.devsenseRangeFormat, p)
        let newdoc = doc.withEdits(edits)

        //
        this.documents.set(newdoc.uri, newdoc)
        return newdoc
    }

    constructor(
    ) {
        const lspath = LS.languageServerPath()
        //const lspath = `${__dirname}/../node_modules/devsense-php-ls-${platform()}-${arch()}/dist/devsense.php.ls.exe`
        //const lspath = "C:/Users/jmise/Projects/phptools-vscode/src/Devsense.PHP.LanguageServer/bin/Debug/net9.0/devsense.php.ls.exe"
        const lsprocess = spawn(lspath ?? path.resolve(lspath), [
            '--composerNodes', 'false', // disable lazy caching of packages in vendor
        ], {
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

    async start(root: string, include: string[], exclude: string[] | undefined, phpVersion: string = '8.4', codeStyle = DefaultCodeStyle) {

        this.connection.onNotification(LSP.devsenseLoadStatus, async (args) => {
            this.loadStatusEvent.fire(args)
        })
        this.connection.onNotification(LSP.windowShowMessage, args => {
            //console.log(args)
        })
        this.connection.onNotification(LSP.windowLogMessage, args => {
            //console.log(args)
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
                'php.format.codeStyle': codeStyle,
            },
        })
    }

    async exit() {
        await this.connection.sendNotification('exit')
        this.connection.end()
    }
}