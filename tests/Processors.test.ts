import { describe, expect, test } from "vitest";
import { FullProc as GetMyClassT, Processor } from "@rdfc/js-runner";
import {
    GlobRead,
    ReadFolder,
    UnzipFile,
    Envsub,
    Substitute,
    GetFileFromFolder,
    FileWriter,
    toPath,
} from "../src/FileUtils";
import { resolve } from "path";
import { ProcHelper } from "@rdfc/js-runner/lib/testUtils";

describe("File Utils tests", async () => {
    async function getProc<T extends Processor<unknown>>(
        config: string,
        ty: string,
        uri = "http://example.com/ns#processor",
    ): Promise<GetMyClassT<T>> {
        const helper = new ProcHelper<T>();

        await helper.importFile(resolve("./processors.ttl"));
        await helper.importInline(
            resolve("pipeline.ttl"),
            "@prefix rdfc: <https://w3id.org/rdf-connect#>." + config,
        );
        const definedConfig = helper.getConfig(ty);

        expect(definedConfig.location).toBeDefined();
        expect(definedConfig.file).toBeDefined();
        expect(definedConfig.clazz).toBeDefined();

        const processor = await helper.getProcessor(uri);

        return processor;
    }

    test("rdfc:GlobRead is properly defined", async () => {
        const proc = await getProc<GlobRead>(
            `<http://example.com/ns#processor> a rdfc:GlobRead; 
                rdfc:glob "./*.json"; 
                rdfc:output <jw>;
                rdfc:wait 0;
                rdfc:closeOnEnd true;
                rdfc:binary true.`,
            "GlobRead",
        );

        expect(proc.constructor.name).toBe(GlobRead.name);

        expect(proc.globPattern).toBe("./*.json");
        expect(proc.wait).toBe(0);
        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.closeOnEnd).toBe(true);
        expect(proc.binary).toBe(true);
    });

    test("rdfc:FolderRead is properly defined", async () => {
        const proc = await getProc<ReadFolder>(
            `<http://example.com/ns#processor> a rdfc:FolderRead; 
                rdfc:folder_location "./src"; 
                rdfc:file_stream <jw>;
                rdfc:max_memory 3.5;
                rdfc:pause 3000.`,
            "FolderRead",
        );

        expect(proc.folder).toBe("./src");
        expect(proc.maxMemory).toBe(3.5);
        expect(proc.pause).toBe(3000);
        expect(proc.writer.constructor.name).toBe("WriterInstance");
    });

    test("rdfc:Envsub is properly defined", async () => {
        const proc = await getProc<Envsub>(
            `<http://example.com/ns#processor> a rdfc:Envsub; 
                rdfc:input <jr>; 
                rdfc:output <jw>.`,
            "Envsub",
        );

        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.reader.constructor.name).toBe("ReaderInstance");
    });

    test("rdfc:Substitute is properly defined", async () => {
        const proc = await getProc<Substitute>(
            `<http://example.com/ns#processor> a rdfc:Substitute; 
                rdfc:input <jr>;
                rdfc:output <jw>;
                rdfc:source "life";
                rdfc:replace "42";
                rdfc:regexp false.`,
            "Substitute",
        );

        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.reader.constructor.name).toBe("ReaderInstance");
        expect(proc.source).toBe("life");
        expect(proc.replace).toBe("42");
        expect(proc.regexp).toBe(false);
    });

    test("rdfc:ReadFile is properly defined", async () => {
        const proc = await getProc<GetFileFromFolder>(
            `<http://example.com/ns#processor> a rdfc:ReadFile; 
                rdfc:input <jr>;
                rdfc:output <jw>;
                rdfc:folderPath ".".`,
            "ReadFile",
        );

        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.reader.constructor.name).toBe("ReaderInstance");
        expect(proc.folderPath).toBe(".");
    });

    test("rdfc:UnzipFile is properly defined", async () => {
        const proc = await getProc<UnzipFile>(
            `<http://example.com/ns#processor> a rdfc:UnzipFile; 
                rdfc:input <jr>;
                rdfc:output <jw>.`,
            "UnzipFile",
        );

        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.reader.constructor.name).toBe("ReaderInstance");
    });

    test("rdfc:GunzipFile is properly defined", async () => {
        const proc = await getProc<UnzipFile>(
            `<http://example.com/ns#processor> a rdfc:GunzipFile; 
                rdfc:input <jr>;
                rdfc:output <jw>.`,
            "GunzipFile",
        );

        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.reader.constructor.name).toBe("ReaderInstance");
    });

    test("rdfc:FileWriter is properly defined", async () => {
        const proc = await getProc<FileWriter>(
            `<http://example.com/ns#processor> a rdfc:FileWriter; 
                rdfc:filePath "./output.txt";
                rdfc:input <jr>;
                rdfc:readAsStream true;
                rdfc:binary false.`,
            "FileWriter",
        );

        expect(proc.filePath).toBe("./output.txt");
        expect(proc.readAsStream).toBe(true);
        expect(proc.binary).toBe(false);
        expect(proc.input.constructor.name).toBe("ReaderInstance");
    });

    test("rdfc:GlobRead falls back to its default values", async () => {
        const proc = await getProc<GlobRead>(
            `<http://example.com/ns#processor> a rdfc:GlobRead;
                rdfc:glob "./*.json";
                rdfc:output <jw>.`,
            "GlobRead",
        );

        expect(proc.wait).toBe(0);
        expect(proc.closeOnEnd).toBe(true);
        expect(proc.binary).toBe(false);
    });

    test("rdfc:FolderRead falls back to its default values", async () => {
        const proc = await getProc<ReadFolder>(
            `<http://example.com/ns#processor> a rdfc:FolderRead;
                rdfc:folder_location "./src";
                rdfc:file_stream <jw>.`,
            "FolderRead",
        );

        expect(proc.maxMemory).toBe(3);
        expect(proc.pause).toBe(5000);
    });

    test("rdfc:Substitute falls back to its default values", async () => {
        const proc = await getProc<Substitute>(
            `<http://example.com/ns#processor> a rdfc:Substitute;
                rdfc:input <jr>;
                rdfc:output <jw>;
                rdfc:source "life";
                rdfc:replace "42".`,
            "Substitute",
        );

        expect(proc.regexp).toBe(false);
    });

    test("rdfc:FileWriter falls back to its default values", async () => {
        const proc = await getProc<FileWriter>(
            `<http://example.com/ns#processor> a rdfc:FileWriter;
                rdfc:filePath "./output.txt";
                rdfc:input <jr>.`,
            "FileWriter",
        );

        expect(proc.readAsStream).toBe(false);
        expect(proc.binary).toBe(false);
    });

    test("locations can be written as IRIs", async () => {
        const glob = await getProc<GlobRead>(
            `<http://example.com/ns#processor> a rdfc:GlobRead;
                rdfc:glob <./tests/data/*.txt>;
                rdfc:output <jw>.`,
            "GlobRead",
        );
        await glob.init();
        expect(glob.files).toEqual([resolve("./tests/data/test.txt")]);

        const folder = await getProc<ReadFolder>(
            `<http://example.com/ns#processor> a rdfc:FolderRead;
                rdfc:folder_location <./tests/data>;
                rdfc:file_stream <jw>.`,
            "FolderRead",
        );
        await folder.init();
        expect(folder.normalizedPath).toBe(resolve("./tests/data"));

        const readFile = await getProc<GetFileFromFolder>(
            `<http://example.com/ns#processor> a rdfc:ReadFile;
                rdfc:input <jr>;
                rdfc:folderPath <./tests/data>;
                rdfc:output <jw>.`,
            "ReadFile",
        );
        expect(toPath(readFile.folderPath)).toBe(resolve("./tests/data"));

        const writer = await getProc<FileWriter>(
            `<http://example.com/ns#processor> a rdfc:FileWriter;
                rdfc:filePath <./output.txt>;
                rdfc:input <jr>.`,
            "FileWriter",
        );
        expect(toPath(writer.filePath)).toBe(resolve("./output.txt"));
    });

    test("toPath keeps paths and turns file: URLs into paths", () => {
        expect(toPath("./data/*.ttl")).toBe("./data/*.ttl");
        expect(toPath("/tmp/out.txt")).toBe("/tmp/out.txt");
        expect(toPath("file:///tmp/my%20data/out.txt")).toBe(
            "/tmp/my data/out.txt",
        );
    });
});
