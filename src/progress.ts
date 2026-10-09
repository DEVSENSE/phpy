import readline from 'readline';

const spinnerFrames = ['-', '\\', '|', '/'];

function formatTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const remainingSeconds = s % 60;
    return m > 0 ? `${m}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

export function progress(stream: NodeJS.WriteStream = process.stdout) {
    const startTime = Date.now();
    let disposed = false

    return {
        update(completed: number, total: number) {
            if (disposed) {
                return
            }

            const now = Date.now();
            const elapsed = now - startTime;

            const avgTimePerPromise = completed > 0 ? elapsed / completed : 0;
            const estimatedTotal = avgTimePerPromise * total;

            const spinner = spinnerFrames[Math.floor(completed * spinnerFrames.length) % spinnerFrames.length];
            const progressLine = `${spinner} ${completed}/${total} completed | ⏱️ ${formatTime(elapsed)} elapsed | ⌛ ~${formatTime(estimatedTotal)} total`;
            readline.clearLine(stream, 0);
            readline.cursorTo(stream, 0);
            stream.write(progressLine);
        },
        done() {
            if (disposed) {
                return
            }
            readline.clearLine(stream, 0);
            readline.cursorTo(stream, 0);
        },
        dispose() {
            this.done()
            disposed = true
        }
    }
}
