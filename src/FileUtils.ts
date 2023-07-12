import { Writer } from "@treecg/connector-types";
import path from "path";
import { Readable } from "stream";
import { access, readdir, readFile } from "fs/promises";

export async function readFolder(folder: string, writer: Writer<string>) {
    const normalizedPath = path.normalize(folder);

    // Check folder exists
    await access(normalizedPath);

    // Read folder content and iterate over each file
    const fileNames = await readdir(normalizedPath, { recursive: true });
    console.log(`[PROCESSOR][readFolder] - Reading these files: ${fileNames}`);
    const fileStream = Readable.from(fileNames);

    // This is needed to avoid that the initial stream gets consumed before the next processor is initialized.
    setTimeout(() => {
        // TODO: Find a way to work in an on-demand mode for consuming streams.
        // Perhaps with AsyncIterators.

        fileStream.on("data", async fileName => {
            writer.push((await readFile(path.join(normalizedPath, fileName))).toString());
            // Try to avoid high water issue. Also avoidable with on-demand consumption
            await sleep(300);
        });
    }, 5000);
}

function sleep(x: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, x));
}