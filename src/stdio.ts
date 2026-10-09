import http from 'http';

export interface StdioForwarderOptions {
    port: number;
    host?: string;
    onClose?: () => void;
}

export class StdioForwarder {
    private readonly host: string;
    private readonly port: number;
    private buffer: Buffer = Buffer.alloc(0);
    private isFramed: boolean | null = null;
    private activeRequests = 0;
    private closed = false;
    private readonly onClose?: () => void;

    constructor(options: StdioForwarderOptions) {
        this.host = options.host ?? '127.0.0.1';
        this.port = options.port;
        this.onClose = options.onClose;
    }

    public start(): void {
        process.stdin.on('data', (chunk: Buffer) => this.handleData(chunk));
        process.stdin.on('end', () => this.handleClose());
        process.stdin.on('close', () => this.handleClose());
        process.stdin.resume();
    }

    private handleClose(): void {
        if (this.closed) return;
        this.closed = true;
        this.onClose?.();
    }

    private handleData(chunk: Buffer): void {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.processBuffer();
    }

    private processBuffer(): void {
        while (this.buffer.length > 0) {
            // Skip leading whitespace / newlines between messages
            let start = 0;
            while (
                start < this.buffer.length &&
                (this.buffer[start] === 32 ||
                    this.buffer[start] === 9 ||
                    this.buffer[start] === 10 ||
                    this.buffer[start] === 13)
            ) {
                start++;
            }
            if (start > 0) {
                this.buffer = this.buffer.subarray(start);
                if (this.buffer.length === 0) break;
            }

            // Detect message framing: Content-Length header or newline-delimited JSON
            if (this.buffer[0] === 123) { // '{' character
                const newlineIndex = this.buffer.indexOf(10); // '\n'
                if (newlineIndex !== -1) {
                    const lineBuf = this.buffer.subarray(0, newlineIndex);
                    this.buffer = this.buffer.subarray(newlineIndex + 1);
                    const line = lineBuf.toString('utf8').trim();
                    if (line) {
                        this.isFramed = false;
                        this.forwardMessage(line);
                    }
                    continue;
                }
                // Incomplete line, wait for more data
                break;
            } else {
                // Header-delimited framing (Content-Length: ... \r\n\r\n <payload>)
                const headerEnd = this.buffer.indexOf('\r\n\r\n');
                if (headerEnd !== -1) {
                    const headerStr = this.buffer.subarray(0, headerEnd).toString('utf8');
                    const match = headerStr.match(/Content-Length:\s*(\d+)/i);
                    if (match) {
                        const contentLength = parseInt(match[1], 10);
                        const headerByteLength = headerEnd + 4;
                        if (this.buffer.length >= headerByteLength + contentLength) {
                            const bodyBuf = this.buffer.subarray(headerByteLength, headerByteLength + contentLength);
                            this.buffer = this.buffer.subarray(headerByteLength + contentLength);
                            this.isFramed = true;
                            this.forwardMessage(bodyBuf.toString('utf8'));
                            continue;
                        } else {
                            // Incomplete body, wait for more data
                            break;
                        }
                    } else {
                        // Unrecognized header, drop up to headerEnd + 4
                        this.buffer = this.buffer.subarray(headerEnd + 4);
                        continue;
                    }
                }
                // Incomplete header, wait for more data
                break;
            }
        }
    }

    private forwardMessage(rawJson: string): void {
        this.activeRequests++;
        const postData = Buffer.from(rawJson, 'utf8');

        const req = http.request(
            {
                hostname: this.host,
                port: this.port,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length,
                },
            },
            (res) => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    this.activeRequests--;
                    if (body && body.trim().length > 0) {
                        this.sendStdout(body.trim());
                    }
                });
            }
        );

        req.on('error', (err) => {
            this.activeRequests--;
            process.stderr.write(`[devsense-php-mcp] Forwarding error: ${err.message}\n`);
        });

        req.write(postData);
        req.end();
    }

    private sendStdout(responseJson: string): void {
        const bodyBuf = Buffer.from(responseJson, 'utf8');
        if (this.isFramed) {
            process.stdout.write(`Content-Length: ${bodyBuf.length}\r\n\r\n${responseJson}`);
        } else {
            process.stdout.write(`${responseJson}\n`);
        }
    }
}

