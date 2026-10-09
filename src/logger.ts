
export class Logger {
    constructor(
        private readonly verbose: boolean,
        private readonly logToStderr: boolean = false
    ) {
    }

    notimplemented(what: string) {
        process.stderr.write(`${what} is not implemented\n`)
    }

    info(text: string) {
        if (this.verbose) {
            const out = this.logToStderr ? process.stderr : process.stdout;
            out.write(`[${new Date().toISOString()}] ${text}\n`)
        }
    }

    error(err: Error) {
        if (err && err.message) {
            process.stderr.write(`${err.message}\n`)
        }
    }
}