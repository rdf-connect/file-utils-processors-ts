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
} from "../src/FileUtils";
import { resolve } from "path";
import { ProcHelper } from "@rdfc/js-runner/lib/testUtils";
import { toPath } from "@rdfc/utils-js";

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
            "@prefix rdfc: <https://w3id.org/rdf-connect#>. @prefix rdfcp: <https://w3id.org/rdf-connect/processors#>." +
                config,
        );
        const definedConfig = helper.getConfig(ty);

        expect(definedConfig.location).toBeDefined();
        expect(definedConfig.file).toBeDefined();
        expect(definedConfig.clazz).toBeDefined();

        const processor = await helper.getProcessor(uri);

        return processor;
    }

    test("rdfcp:GlobRead is properly defined", async () => {
        const proc = await getProc<GlobRead>(
            `<http://example.com/ns#processor> a rdfcp:GlobRead; 
                rdfcp:glob "./*.json"; 
                rdfcp:output <jw>;
                rdfcp:wait 0;
                rdfcp:closeOnEnd true;
                rdfcp:binary true.`,
            "GlobRead",
        );

        expect(proc.constructor.name).toBe(GlobRead.name);

        expect(proc.globPattern).toBe("./*.json");
        expect(proc.wait).toBe(0);
        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.closeOnEnd).toBe(true);
        expect(proc.binary).toBe(true);
    });

    test("rdfcp:FolderRead is properly defined", async () => {
        const proc = await getProc<ReadFolder>(
            `<http://example.com/ns#processor> a rdfcp:FolderRead; 
                rdfcp:folder_location "./src"; 
                rdfcp:output <jw>;
                rdfcp:max_memory 3.5;
                rdfcp:pause 3000.`,
            "FolderRead",
        );

        expect(proc.folder).toBe("./src");
        expect(proc.maxMemory).toBe(3.5);
        expect(proc.pause).toBe(3000);
        expect(proc.writer.constructor.name).toBe("WriterInstance");
    });

    test("rdfcp:Envsub is properly defined", async () => {
        const proc = await getProc<Envsub>(
            `<http://example.com/ns#processor> a rdfcp:Envsub; 
                rdfcp:input <jr>; 
                rdfcp:output <jw>.`,
            "Envsub",
        );

        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.reader.constructor.name).toBe("ReaderInstance");
    });

    test("rdfcp:Substitute is properly defined", async () => {
        const proc = await getProc<Substitute>(
            `<http://example.com/ns#processor> a rdfcp:Substitute; 
                rdfcp:input <jr>;
                rdfcp:output <jw>;
                rdfcp:source "life";
                rdfcp:replace "42";
                rdfcp:regexp false.`,
            "Substitute",
        );

        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.reader.constructor.name).toBe("ReaderInstance");
        expect(proc.source).toBe("life");
        expect(proc.replace).toBe("42");
        expect(proc.regexp).toBe(false);
    });

    test("rdfcp:ReadFile is properly defined", async () => {
        const proc = await getProc<GetFileFromFolder>(
            `<http://example.com/ns#processor> a rdfcp:ReadFile; 
                rdfcp:input <jr>;
                rdfcp:output <jw>;
                rdfcp:folderPath ".".`,
            "ReadFile",
        );

        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.reader.constructor.name).toBe("ReaderInstance");
        expect(proc.folderPath).toBe(".");
    });

    test("rdfcp:UnzipFile is properly defined", async () => {
        const proc = await getProc<UnzipFile>(
            `<http://example.com/ns#processor> a rdfcp:UnzipFile; 
                rdfcp:input <jr>;
                rdfcp:output <jw>.`,
            "UnzipFile",
        );

        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.reader.constructor.name).toBe("ReaderInstance");
    });

    test("rdfcp:GunzipFile is properly defined", async () => {
        const proc = await getProc<UnzipFile>(
            `<http://example.com/ns#processor> a rdfcp:GunzipFile; 
                rdfcp:input <jr>;
                rdfcp:output <jw>.`,
            "GunzipFile",
        );

        expect(proc.writer.constructor.name).toBe("WriterInstance");
        expect(proc.reader.constructor.name).toBe("ReaderInstance");
    });

    test("rdfcp:FileWriter is properly defined", async () => {
        const proc = await getProc<FileWriter>(
            `<http://example.com/ns#processor> a rdfcp:FileWriter; 
                rdfcp:filePath "./output.txt";
                rdfcp:input <jr>;
                rdfcp:readAsStream true;
                rdfcp:binary false.`,
            "FileWriter",
        );

        expect(proc.filePath).toBe("./output.txt");
        expect(proc.readAsStream).toBe(true);
        expect(proc.binary).toBe(false);
        expect(proc.input.constructor.name).toBe("ReaderInstance");
    });

    test("rdfcp:GlobRead falls back to its default values", async () => {
        const proc = await getProc<GlobRead>(
            `<http://example.com/ns#processor> a rdfcp:GlobRead;
                rdfcp:glob "./*.json";
                rdfcp:output <jw>.`,
            "GlobRead",
        );

        expect(proc.wait).toBe(0);
        expect(proc.closeOnEnd).toBe(true);
        expect(proc.binary).toBe(false);
    });

    test("rdfcp:FolderRead falls back to its default values", async () => {
        const proc = await getProc<ReadFolder>(
            `<http://example.com/ns#processor> a rdfcp:FolderRead;
                rdfcp:folder_location "./src";
                rdfcp:output <jw>.`,
            "FolderRead",
        );

        expect(proc.maxMemory).toBe(3);
        expect(proc.pause).toBe(5000);
    });

    test("rdfcp:Substitute falls back to its default values", async () => {
        const proc = await getProc<Substitute>(
            `<http://example.com/ns#processor> a rdfcp:Substitute;
                rdfcp:input <jr>;
                rdfcp:output <jw>;
                rdfcp:source "life";
                rdfcp:replace "42".`,
            "Substitute",
        );

        expect(proc.regexp).toBe(false);
    });

    test("rdfcp:FileWriter falls back to its default values", async () => {
        const proc = await getProc<FileWriter>(
            `<http://example.com/ns#processor> a rdfcp:FileWriter;
                rdfcp:filePath "./output.txt";
                rdfcp:input <jr>.`,
            "FileWriter",
        );

        expect(proc.readAsStream).toBe(false);
        expect(proc.binary).toBe(false);
    });

    test("locations can be written as IRIs", async () => {
        const glob = await getProc<GlobRead>(
            `<http://example.com/ns#processor> a rdfcp:GlobRead;
                rdfcp:glob <./tests/data/*.txt>;
                rdfcp:output <jw>.`,
            "GlobRead",
        );
        await glob.init();
        expect(glob.files).toEqual([resolve("./tests/data/test.txt")]);

        const folder = await getProc<ReadFolder>(
            `<http://example.com/ns#processor> a rdfcp:FolderRead;
                rdfcp:folder_location <./tests/data>;
                rdfcp:output <jw>.`,
            "FolderRead",
        );
        await folder.init();
        expect(folder.normalizedPath).toBe(resolve("./tests/data"));

        const readFile = await getProc<GetFileFromFolder>(
            `<http://example.com/ns#processor> a rdfcp:ReadFile;
                rdfcp:input <jr>;
                rdfcp:folderPath <./tests/data>;
                rdfcp:output <jw>.`,
            "ReadFile",
        );
        expect(toPath(readFile.folderPath)).toBe(resolve("./tests/data"));

        const writer = await getProc<FileWriter>(
            `<http://example.com/ns#processor> a rdfcp:FileWriter;
                rdfcp:filePath <./output.txt>;
                rdfcp:input <jr>.`,
            "FileWriter",
        );
        expect(toPath(writer.filePath)).toBe(resolve("./output.txt"));
    });
});
