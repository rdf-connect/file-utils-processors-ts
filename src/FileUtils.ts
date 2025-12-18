import { Processor, Reader, Writer } from "@rdfc/js-runner";
import path from "path";
import { memoryUsage } from "node:process";
import { access, readdir, readFile, stat, appendFile } from "fs/promises";
import { glob } from "glob";
import AdmZip from "adm-zip";
import * as zlib from "node:zlib";
import { createReadStream, createWriteStream } from "fs";
import { Readable } from "stream";

type GlobReadInp = {
    globPattern: string;
    writer: Writer;
    wait: number;
    closeOnEnd: boolean;
    binary: boolean;
};
export class GlobRead extends Processor<GlobReadInp> {
    files: string[] = [];

    async init(this: GlobReadInp & this): Promise<void> {
        this.wait = this.wait ?? 0;
        this.closeOnEnd = this.closeOnEnd ?? true;
        this.binary = this.binary ?? false;

        if (this.globPattern.startsWith("file://")) {
            this.globPattern = this.globPattern.slice("file://".length);
        }
        this.files = await glob(this.globPattern, {});

        this.logger.info(
            "Glob results " +
                JSON.stringify(this.files) +
                " from glob pattern " +
                this.globPattern,
        );
    }
    async transform(this: GlobReadInp & this): Promise<void> {
        // nothing
    }
    async produce(this: GlobReadInp & this): Promise<void> {
        for (const file of this.files) {
            const size = (await stat(file)).size;
            this.logger.info(
                `Reading and sending file "${file}" of size ${Math.round(
                    size / 1024,
                )} KB`,
            );

            // If it is larger then 5 mega bytes, stream it over
            if (size > 5 * 1024 * 1024) {
                await this.writer.stream(readFileInChunks(file));
            } else {
                await this.writer.buffer(await readFile(file));
            }
            await new Promise((res) => setTimeout(res, this.wait));
        }

        if (this.closeOnEnd) {
            // Signal that all files were streamed
            await this.writer.close();
        }
    }
}

async function* readFileInChunks(
    filePath: string,
    highWaterMark: number | undefined = 1024,
) {
    const stream = createReadStream(filePath, { highWaterMark });

    for await (const chunk of stream) {
        yield chunk;
    }
}

type ReadFolderArg = {
    folder: string;
    writer: Writer;
    maxMemory: number;
    pause: number;
};
export class ReadFolder extends Processor<ReadFolderArg> {
    fileNames: string[];
    normalizedPath: string;
    async init(this: ReadFolderArg & this): Promise<void> {
        this.maxMemory = this.maxMemory ?? 3;
        this.pause = this.pause ?? 5000;

        this.normalizedPath = path.normalize(this.folder);

        // Check folder exists
        await access(this.normalizedPath);

        // Read folder content and iterate over each file
        this.fileNames = await readdir(this.normalizedPath, {
            recursive: true,
        });
        this.logger.info(`Reading these files: ${this.fileNames}`);
    }
    async transform(this: ReadFolderArg & this): Promise<void> {
        // nothing
    }
    async produce(this: ReadFolderArg & this): Promise<void> {
        for (const fileName of this.fileNames) {
            const fullPath = path.join(this.normalizedPath, fileName);
            const stats = await stat(fullPath);
            // Skip directories
            if (!stats.isFile()) {
                continue;
            }
            // Monitor process memory to avoid high-water memory crashes
            this.logger.info(`[readFolder] processing '${fileName}'`);
            if (memoryUsage().heapUsed > this.maxMemory * 1024 * 1024 * 1024) {
                this.logger.warn(
                    `[readFolder] Phew! too much data (used ${Math.round((memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} Mb)...waiting for ${this.pause / 1000}s`,
                );
                await sleep(this.pause);
            }

            if (stats.size > 5 * 1024 * 1024) {
                await this.writer.stream(
                    readFileInChunks(path.join(this.normalizedPath, fileName)),
                );
            } else {
                const msg = await readFile(
                    path.join(this.normalizedPath, fileName),
                );
                await this.writer.buffer(msg);
            }
        }

        // Signal that all files were streamed
        await this.writer.close();
    }
}

function sleep(x: number): Promise<unknown> {
    return new Promise((resolve) => setTimeout(resolve, x));
}

type SubstituteArgs = {
    reader: Reader;
    writer: Writer;
    source: string;
    replace: string;
    regexp: boolean;
};

export class Substitute extends Processor<SubstituteArgs> {
    reg: RegExp | string;
    async init(this: SubstituteArgs & this): Promise<void> {
        this.reg = this.regexp ? new RegExp(this.source) : this.source;
    }
    async transform(this: SubstituteArgs & this): Promise<void> {
        for await (const msg of this.reader.strings()) {
            this.logger.info(
                `Replacing '${this.source}' by '${this.replace}' on input text`,
            );
            await this.writer.string(msg.replaceAll(this.reg, this.replace));
        }
        this.logger.info("Writer closed, so closing reader as well.");
        await this.writer.close();
    }
    async produce(this: SubstituteArgs & this): Promise<void> {
        // nothing
    }
}

type EnvSubArgs = {
    reader: Reader;
    writer: Writer;
};
export class Envsub extends Processor<EnvSubArgs> {
    async init(this: EnvSubArgs & this): Promise<void> {
        // nothing
    }
    async transform(this: EnvSubArgs & this): Promise<void> {
        const env = process.env;
        for await (let x of this.reader.strings()) {
            this.logger.info("Replacing environment variable on input text");
            Object.keys(env).forEach((key) => {
                const v = env[key];
                if (v) {
                    x = x.replaceAll(`\${${key}}`, v);
                }
            });

            await this.writer.string(x);
        }
        await this.writer.close();
    }
    async produce(this: EnvSubArgs & this): Promise<void> {
        // nothing
    }
}

type GetFileFromFolderArgs = {
    reader: Reader;
    folderPath: string;
    writer: Writer;
};

export class GetFileFromFolder extends Processor<GetFileFromFolderArgs> {
    async init(this: GetFileFromFolderArgs & this): Promise<void> {
        // nothing
    }
    async transform(this: GetFileFromFolderArgs & this): Promise<void> {
        for await (const name of this.reader.strings()) {
            const filePath = path.join(path.resolve(this.folderPath), name);
            this.logger.info(`Reading file at '${filePath}'`);
            const f = await stat(filePath);
            if (f.size > 5 * 1024 * 1024) {
                await this.writer.stream(readFileInChunks(filePath));
            } else {
                const file = await readFile(filePath, "utf8");
                await this.writer.string(file);
            }
        }
        await this.writer.close();
    }
    async produce(this: GetFileFromFolderArgs & this): Promise<void> {
        // nothing
    }
}

type UnzipArgs = {
    reader: Reader;
    writer: Writer;
};

export class UnzipFile extends Processor<UnzipArgs> {
    async init(this: UnzipArgs & this): Promise<void> {
        // nothing
    }
    async transform(this: UnzipArgs & this): Promise<void> {
        for await (const data of this.reader.buffers()) {
            try {
                const adm = new AdmZip(Buffer.from(data.buffer));
                for (const entry of adm.getEntries()) {
                    this.logger.info(
                        `Unzipping received file '${entry.entryName}'`,
                    );
                    await this.writer.buffer(entry.getData());
                }
            } catch (ex) {
                this.logger.error("Ignoring invalid ZIP file received");
                this.logger.debug(ex);
            }
        }
        await this.writer.close();
    }
    async produce(this: UnzipArgs & this): Promise<void> {
        // nothing
    }
}

export class GunzipFile extends Processor<UnzipArgs> {
    async init(this: UnzipArgs & this): Promise<void> {
        // nothing
    }
    async transform(this: UnzipArgs & this): Promise<void> {
        for await (const stream of this.reader.streams()) {
            try {
                const readableStream = Readable.from(stream);
                const gunzipper = zlib.createGunzip();
                this.logger.info("Gunzipping received file");
                await this.writer.stream(
                    (async function* () {
                        yield* readableStream.pipe(gunzipper);
                    })(),
                );
            } catch (ex) {
                this.logger.error("Ignoring invalid GZIP file received");
                this.logger.debug(ex);
            }
        }

        await this.writer.close();
    }
    async produce(this: UnzipArgs & this): Promise<void> {
        // nothing
    }
}

type FileWriterArgs = {
    input: Reader;
    filePath: string;
    readAsStream?: boolean;
    binary?: boolean;
};

export class FileWriter extends Processor<FileWriterArgs> {
    async init(this: FileWriterArgs & this): Promise<void> {
        // nothing
    }

    async transform(this: FileWriterArgs & this): Promise<void> {
        if (this.readAsStream) {
            const diskWriter = createWriteStream(path.normalize(this.filePath));
            for await (const stream of this.input.streams()) {
                for await (const chunk of stream) {
                    diskWriter.write(chunk);
                }
            }
            diskWriter.end();
        } else {
            if (this.binary) {
                for await (const dump of this.input.buffers()) {
                    await appendFile(path.normalize(this.filePath), dump);
                }
            } else {
                for await (const dump of this.input.strings()) {
                    await appendFile(path.normalize(this.filePath), dump);
                }
            }
        }
    }

    async produce(this: FileWriterArgs & this): Promise<void> {
        // nothing
    }
}
