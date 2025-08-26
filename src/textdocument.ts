import { readFileSync, writeFileSync } from "fs";
import { LSP } from "./client";
import { compare } from "./math";

export class TextDocument {

    private readonly linebreaks: number[]

    get lineCount() {
        return this.linebreaks.length + 1
    }

    private constructor(
        readonly uri: string,
        readonly content: string,
        readonly langId: string,
        readonly version: number
    ) {
        this.linebreaks = TextDocument.resolveEol(content)
    }

    /** find line endings */
    private static resolveEol(content: string) {
        let eols: number[] = []
        let lineFrom = 0
        while (lineFrom < content.length) {

            var eol = content.indexOf('\n', lineFrom) + 1
            if (eol > 0) {
                eols.push(eol)
                lineFrom = eol
            }
            else {
                break
            }
        }

        //
        return eols
    }

    static fromUri(uriString: string, langId: 'php'): TextDocument {
        let uri = URL.parse(uriString)
        if (uri == null) {
            throw new Error(`Invalid URI '${uriString}'`)
        }

        return new TextDocument(
            uriString,
            readFileSync(uri.pathname, { encoding: 'utf8' }),
            langId,
            0
        )
    }

    save(uriString: string) {
        let uri = URL.parse(uriString)
        if (uri == null) {
            throw new Error(`Invalid URI '${uriString}'`)
        }
        writeFileSync(uri.pathname, this.content, { encoding: 'utf8', })
    }

    private getLineSpan(lineNo: number): { start: number, length: number }|undefined {
        if (lineNo < 0 || lineNo >= this.lineCount) {
            return undefined
        }

        let start = lineNo <= 0 ? 0 : this.linebreaks[lineNo - 1]
        let end = lineNo >= this.linebreaks.length ? this.content.length : this.linebreaks[lineNo]

        return {
            start: start,
            length: end - start
        }
    }

    private toPosition(p: LSP.Position): number {
        var line = this.getLineSpan(p.line)
        if (line == undefined) {
            return -1
        }
        return line.start + Math.min(p.character, line.length)
    }

    private toSpan(range: LSP.Range): { start: number, length: number } {

        let start = this.toPosition(range.start)
        let end = this.toPosition(range.end)

        return {
            start: start,
            length: end - start,
        }
    }

    withEdits(edits: LSP.TextEdit[]): TextDocument {
        if (!edits || edits.length == 0) {
            return this
        }

        // sort from end to start
        edits.sort((a, b) => compare(b.range.start, a.range.start))

        let content = this.content
        let prev: LSP.TextEdit|undefined = undefined
        for (const edit of edits) {
            if (prev && compare(edit.range.end, prev.range.start) > 0) { // overlapping edits
                continue
            }

            // apply edit
            var span = this.toSpan(edit.range)
            content = content.substring(0, span.start) + edit.newText + content.substring(span.start + span.length)

            //
            prev = edit
        }

        return new TextDocument(
            this.uri,
            content,
            this.langId,
            this.version + 1
        )
    }
}