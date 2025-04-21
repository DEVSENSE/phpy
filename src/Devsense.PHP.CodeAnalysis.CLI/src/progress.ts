import readline from 'readline';

const spinnerFrames = ['-', '\\', '|', '/'];

export const DefaultConcurrency = 8

function formatTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const remainingSeconds = s % 60;
    return m > 0 ? `${m}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

class Progress {
    public completed: number = 0
    constructor(public readonly total: number) { }
}

async function worker(promisesFn: (() => Promise<unknown>)[], concurrency: number = DefaultConcurrency, progress: Progress) {
    let pending: Promise<unknown>[] = [] // active promises
    //let semaphore = new Promise(r => );

    if (typeof (concurrency) != 'number' || !concurrency || concurrency <= 0) {
        concurrency = DefaultConcurrency
    }

    while (promisesFn.length) {

        let p = (async (fn) => {
            if (fn) {
                try { await fn() } catch { }
            }
        })(promisesFn.pop())
        
        pending.push(p)

        p.then(() => {
            pending = pending.filter(x => x != p)
            progress.completed++
        })

        //
        if (pending.length >= concurrency) {
            await Promise.race(pending)
        }
    }

    // wait for last ones
    await Promise.all(pending)
}

export async function showProgress(promisesFn: (() => Promise<unknown>)[], concurrency: number = DefaultConcurrency) {
    let progress = new Progress(promisesFn.length)
    let frameIndex = 0;
    const startTime = Date.now();

    const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;

        const avgTimePerPromise = progress.completed > 0 ? elapsed / progress.completed : 0;
        const estimatedTotal = avgTimePerPromise * progress.total;

        const spinner = spinnerFrames[frameIndex % spinnerFrames.length];
        frameIndex++;

        const progressLine = `${spinner} ${progress.completed}/${progress.total} indexed | ⏱️ ${formatTime(elapsed)} elapsed | ⌛ ~${formatTime(estimatedTotal)} total`;

        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(progressLine);
    }, 500);

    // process promises async
    await worker(promisesFn, concurrency, progress)

    //
    clearInterval(interval);
    const totalTime = Date.now() - startTime;
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(`✅ ${progress.total} file(s) indexed in ${formatTime(totalTime)}.`);
}