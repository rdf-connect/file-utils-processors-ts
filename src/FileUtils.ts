import { Stream, Writer } from "@treecg/connector-types";
import path from "path";
import { memoryUsage } from "node:process";
import { access, readdir, readFile } from "fs/promises";
import { glob } from "glob";

export async function globRead(globPattern: string, writer: Writer<string>, wait: number = 0) {
    const jsfiles = await glob(globPattern, {});
    const files = await Promise.all(
        jsfiles.map((x) => readFile(x, { encoding: "utf8" })),
    );

    // This is a source processor (i.e, the first processor in a pipeline),
    // therefore we should wait until the rest of the pipeline is set
    // to start pushing down data
    return async () => {
        for (let file of files) {
            await writer.push(file);
            await new Promise((res) => setTimeout(res, wait));
        }

        // Signal that all files were streamed
        await writer.end();
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
    console.log(`[PROCESSOR][readFolder] - Reading these files: ${fileNames}`);

    // This is a source processor (i.e, the first processor in a pipeline),
    // therefore we should wait until the rest of the pipeline is set
    // to start pushing down data
    return async () => {
        for (const fileName of fileNames) {
            // Monitor process memory to avoid high-water memory crashes
            console.log(`[PROCESSOR][readFolder] - processing ${fileName}`);
            if (memoryUsage().heapUsed > maxMemory * 1024 * 1024 * 1024) {
                console.log(`[PROCESSOR][readFolder] - Phew! too much data (used ${Math.round((memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} Mb)...waiting for ${pause / 1000}s`);
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

    reader.data(x => writer.push(x.replaceAll(reg, replace)));
    reader.on("end", async () => {
        await writer.end();
    });
}

export function envsub(reader: Stream<string>, writer: Writer<string>) {
    const env = process.env;

    reader.data(x => {
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