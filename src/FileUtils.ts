import { Stream, Writer } from "@rdfc/js-runner";
import path from "path";
import { memoryUsage } from "node:process";
import { access, readdir, readFile } from "fs/promises";
import { glob } from "glob";
import AdmZip from "adm-zip";

export async function globRead(
    globPattern: string,
    writer: Writer<string | Buffer>,
    wait: number = 0,
    closeOnEnd: boolean = true,
    binary: boolean = false
) {
    const jsfiles = await glob(globPattern, {});
    const files = await Promise.all(
        jsfiles.map((x) => {
            console.log(`[globRead] reading file ${x} (from glob pattern ${globPattern})`);
            return readFile(x, binary ? {} : { encoding: "utf8" });
        }),
    );

    // This is a source processor (i.e, the first processor in a pipeline),
    // therefore we should wait until the rest of the pipeline is set
    // to start pushing down data
    return async () => {
        for (let file of files) {
            await writer.push(file);
            await new Promise((res) => setTimeout(res, wait));
        }

        if (closeOnEnd) {
            // Signal that all files were streamed
            await writer.end();
        }
    };
}

export async function readFolder(
    folder: string,
    writer: Writer<string>,
    maxMemory: number = 3,
    pause: number = 5000
) {
    const normalizedPath = path.normalize(folder);

    // Check folder exists
    await access(normalizedPath);

    // Read folder content and iterate over each file
    const fileNames = await readdir(normalizedPath, { recursive: true });
    console.log(`[readFolder] Reading these files: ${fileNames}`);

    // This is a source processor (i.e, the first processor in a pipeline),
    // therefore we should wait until the rest of the pipeline is set
    // to start pushing down data
    return async () => {
        for (const fileName of fileNames) {
            // Monitor process memory to avoid high-water memory crashes
            console.log(`[readFolder] processing ${fileName}`);
            if (memoryUsage().heapUsed > maxMemory * 1024 * 1024 * 1024) {
                console.log(`[readFolder] Phew! too much data (used ${Math.round((memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} Mb)...waiting for ${pause / 1000}s`);
                await sleep(pause);
            }

            await writer.push((await readFile(path.join(normalizedPath, fileName))).toString());
        }

        // Signal that all files were streamed
        await writer.end();
    }
}

function sleep(x: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, x));
}

export function substitute(
    reader: Stream<string>,
    writer: Writer<string>,
    source: string,
    replace: string,
    regexp = false
) {
    const reg = regexp ? new RegExp(source) : source;

    reader.data(x => {
        console.log(`[substitute] replacing ${source} by ${replace} on input text`);
        writer.push(x.replaceAll(reg, replace))
    });
    reader.on("end", async () => {
        await writer.end();
    });
}

export function envsub(reader: Stream<string>, writer: Writer<string>) {
    const env = process.env;

    reader.data(x => {
        console.log(`[envsub] replacing environment variable on input text`);
        Object.keys(env).forEach(key => {
            const v = env[key];
            if (v) {
                x = x.replaceAll(`\${${key}}`, v);
            }
        });

        return writer.push(x);
    });
    reader.on("end", async () => {
        await writer.end();
    });
}

export function getFileFromFolder(reader: Stream<string>, folderPath: string, writer: Writer<string>) {
    reader.data(async name => {
        try {
            const filePath = path.join(path.resolve(folderPath), name);
            console.log(`[getFileFromFolder] reading file at ${filePath}`);
            const file = await readFile(filePath, "utf8");
            await writer.push(file);
        } catch (err) {
            throw err;
        }
    });

    reader.on("end", async () => await writer.end());
}

export function unzipFile(reader: Stream<Buffer>, writer: Writer<string>) {
    reader.data(async data => {
        try {
            const adm = new AdmZip(data);
            for (const entry of adm.getEntries()) {
                console.log(`[unzipFile] unzipping received file ${entry.entryName}`);
                await writer.push(entry.getData().toString());
            }
        } catch (ex) {
            console.error("[unzipFile] Ignoring invalid ZIP file received");
        }
    });

    reader.on("end", async () => await writer.end());
}
