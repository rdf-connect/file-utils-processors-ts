import { Writer } from "@treecg/connector-types";
import path from "path";
import { access, readdir, readFile } from "fs/promises";

export async function readFolder(folder: string, writer: Writer<string>) {
    const normalizedPath = path.normalize(folder);

    // Check folder exists
    await access(normalizedPath);

    // Read folder content and iterate over each file
    const fileNames = await readdir(normalizedPath, { recursive: true });
    for(const fileName of fileNames) {
        writer.push((await readFile(path.join(normalizedPath, fileName))).toString());
    }
}