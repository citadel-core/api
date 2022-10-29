export default class ElectrumClient {
    #connection: Deno.TcpConn | Deno.TlsConn | null = null;
    #connectionPromise: Promise<Deno.TcpConn | Deno.TlsConn> | null;
    #requests = 0;
    constructor(
        hostname: string,
        port: number,
    );
    constructor(
        hostname: string,
        port: number,
        transport: "tcp" | "tls",
    );
    constructor(
        hostname: string,
        port: number,
        transport: "tls",
        tlsOptions: {
            /**
             * PEM formatted client certificate chain.
             */
            certChain?: string;
            /**
             * PEM formatted (RSA or PKCS8) private key of client certificate.
             */
            privateKey?: string;
            /**
             * Application-Layer Protocol Negotiation (ALPN) protocols supported by
             * the client. If not specified, no ALPN extension will be included in the
             * TLS handshake.
             */
            alpnProtocols?: string[];
        },
    );
    constructor(
        private hostname: string,
        private port: number,
        private transport: "tcp" | "tls" = "tcp",
        private tlsOptions: {
            /**
             * PEM formatted client certificate chain.
             */
            certChain?: string;
            /**
             * PEM formatted (RSA or PKCS8) private key of client certificate.
             */
            privateKey?: string;
            /**
             * Application-Layer Protocol Negotiation (ALPN) protocols supported by
             * the client. If not specified, no ALPN extension will be included in the
             * TLS handshake.
             */
            alpnProtocols?: string[];
        } = {},
    ) {
        if (transport == "tcp") {
            this.#connectionPromise = Deno.connect({
                hostname,
                port,
                transport: transport,
            });
        } else if (transport == "tls") {
            this.#connectionPromise = Deno.connectTls({
                hostname,
                port,
                ...tlsOptions,
            });
        } else {
            throw new TypeError("Unknown transport");
        }
    }

    async connect() {
        if (this.#connection) return;
        if (this.#connectionPromise) {
            this.#connection = await this.#connectionPromise;
            this.#connectionPromise = null;
        } else {
            if (this.transport == "tcp") {
                this.#connection = await Deno.connect({
                    hostname: this.hostname,
                    port: this.port,
                    transport: this.transport,
                });
            } else if (this.transport == "tls") {
                this.#connection = await Deno.connectTls({
                    hostname: this.hostname,
                    port: this.port,
                    ...this.tlsOptions,
                });
            }
        }
        await this.#sendRequest("server.version", ["Deno Electrum Client", "1.4"])
    }

    async disconnect() {
        try {
            await this.#connection!.close();
            this.#connection = null;
        } catch (err) {
            console.error(err);
        }
    }

    async sendRequest<ReturnType extends unknown = unknown>(method: string, params: unknown): Promise<ReturnType> {
        this.#requests++;
        if (!this.#connection) {
            throw new Error("Not connected! Did you forget to call connect()?");
        }
        const id = this.#requests;
        try {
            await this.#connection!.write(
                new TextEncoder().encode(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        id,
                        method,
                        params,
                    }) + "\r\n",
                ),
            );
        } catch (err: unknown) {
            console.error(err);
            this.disconnect();
            this.connect();
            await this.#connection!.write(
                new TextEncoder().encode(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        id,
                        method,
                        params,
                    }) + "\r\n",
                ),
            );
        }
        const buffer = new Uint8Array(32 * 1024);
        const read = await this.#connection.read(buffer);
        const content = buffer.slice(0, read!);
        const data = JSON.parse(new TextDecoder().decode(content!));
        if (data.id !== id) {
            throw new Error("Response id does not match request ID!");
        }
        return data.result;
    }

    async #sendRequest<ReturnType extends unknown = unknown>(method: string, params: unknown): Promise<ReturnType> {
        this.#requests++;
        if (!this.#connection) {
            throw new Error("Not connected! Did you forget to call connect()?");
        }
        const id = this.#requests;
        await this.#connection!.write(
            new TextEncoder().encode(
                JSON.stringify({
                    jsonrpc: "2.0",
                    id,
                    method,
                    params,
                }) + "\r\n",
            ),
        );
        const buffer = new Uint8Array(32 * 1024);
        const read = await this.#connection.read(buffer);
        const content = buffer.slice(0, read!);
        const data = JSON.parse(new TextDecoder().decode(content!));
        if (data.id !== id) {
            throw new Error("Response id does not match request ID!");
        }
        return data.result;
    }
}
