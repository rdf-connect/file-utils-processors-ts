import { describe, expect, test } from "vitest";
import { FullProc as GetMyClassT, Processor } from "@rdfc/js-runner";
import {
    GlobRead,
    ReadFolder,
    UnzipFile,
    Envsub,
    Substitute,
    GetFileFromFolder,
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
});
