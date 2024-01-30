import { describe, expect, test } from "@jest/globals";
import { extractProcessors, extractSteps, Source } from "@ajuvercr/js-runner";


describe("File Utils tests", () => {
    const pipeline = `
        @prefix js: <https://w3id.org/conn/js#>.
        @prefix ws: <https://w3id.org/conn/ws#>.
        @prefix : <https://w3id.org/conn#>.
        @prefix owl: <http://www.w3.org/2002/07/owl#>.
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
        @prefix sh: <http://www.w3.org/ns/shacl#>.

        <> owl:imports <./node_modules/@ajuvercr/js-runner/ontology.ttl>, <./processors.ttl>.

        [ ] a :Channel;
            :reader <jr>;
            :writer <jw>.
            
        <jr> a js:JsReaderChannel.
        <jw> a js:JsWriterChannel.
    `;

    const baseIRI = process.cwd() + "/config.ttl";

    test("js:GlobRead is properly defined", async () => {
        const proc = `
            [ ] a js:GlobRead; 
                js:glob "./*"; 
                js:output <jw>;
                js:wait 0.
        `;

        const source: Source = {
            value: pipeline + proc,
            baseIRI,
            type: "memory",
        };

        const { processors, quads, shapes: config } = await extractProcessors(source);
        const env = processors.find((x) => x.ty.value.endsWith("GlobRead"))!;
        expect(env).toBeDefined();

        const argss = extractSteps(env, quads, config);
        expect(argss.length).toBe(1);
        expect(argss[0].length).toBe(3);

        const [[glob, output, wait]] = argss;
        expect(glob).toBe("./*");
        testWriter(output);
        expect(wait).toBe(0);

        await checkProc(env.file, env.func);
    });

    test("js:FolderRead is properly defined", async () => {
        const proc = `
            [ ] a js:FolderRead; 
                js:folder_location "./data"; 
                js:file_stream <jw>;
                js:max_memory 3.5;
                js:pause 3000.
        `;

        const source: Source = {
            value: pipeline + proc,
            baseIRI,
            type: "memory",
        };

        const { processors, quads, shapes: config } = await extractProcessors(source);
        const env = processors.find((x) => x.ty.value.endsWith("FolderRead"))!;
        expect(env).toBeDefined();

        const argss = extractSteps(env, quads, config);
        expect(argss.length).toBe(1);
        expect(argss[0].length).toBe(4);

        const [[folder_location, file_Stream, max_memory, pause]] = argss;
        expect(folder_location).toBe("./data");
        testWriter(file_Stream);
        expect(max_memory).toBe(3.5);
        expect(pause).toBe(3000)

        await checkProc(env.file, env.func);
    });

    test("js:Envsub is properly defined", async () => {
        const proc = `
            [ ] a js:Envsub; 
                js:input <jr>; 
                js:output <jw>.
        `;

        const source: Source = {
            value: pipeline + proc,
            baseIRI,
            type: "memory",
        };

        const { processors, quads, shapes: config } = await extractProcessors(source);
        const env = processors.find((x) => x.ty.value.endsWith("Envsub"))!;
        expect(env).toBeDefined();

        const argss = extractSteps(env, quads, config);
        expect(argss.length).toBe(1);
        expect(argss[0].length).toBe(2);

        const [[input, output]] = argss;
        testReader(input);
        testWriter(output);

        await checkProc(env.file, env.func);
    });

    test("js:Substitute is properly defined", async () => {
        const proc = `
            [ ] a js:Substitute; 
                js:input <jr>;
                js:output <jw>;
                js:source "life";
                js:replace "42";
                js:regexp false.
        `;

        const source: Source = {
            value: pipeline + proc,
            baseIRI,
            type: "memory",
        };

        const { processors, quads, shapes: config } = await extractProcessors(source);
        const sub = processors.find((x) => x.ty.value.endsWith("Substitute"))!;

        expect(sub).toBeDefined();
        const argss = extractSteps(sub, quads, config);
        expect(argss.length).toBe(1);
        expect(argss[0].length).toBe(5);

        const [[input, output, s, replace, regexp]] = argss;
        testReader(input);
        testWriter(output);
        expect(s).toBe("life");
        expect(replace).toBe("42");
        expect(regexp).toBe(false);

        await checkProc(sub.file, sub.func);
    });

    test("js:ReadFile is properly defined", async () => {
        const proc = `
            [ ] a js:ReadFile; 
                js:input <jr>;
                js:output <jw>;
                js:folderPath ".".
        `;

        const source: Source = {
            value: pipeline + proc,
            baseIRI,
            type: "memory",
        };

        const { processors, quads, shapes: config } = await extractProcessors(source);
        const sub = processors.find((x) => x.ty.value.endsWith("ReadFile"))!;
        
        expect(sub).toBeDefined();
        const argss = extractSteps(sub, quads, config);
        expect(argss.length).toBe(1);
        expect(argss[0].length).toBe(3);

        const [[input, folderPath, output]] = argss;
        testReader(input);
        testWriter(output);
        expect(folderPath).toBe(".");

        await checkProc(sub.file, sub.func);
    });

    test("js:UnzipFile is properly defined", async () => {
        const proc = `
            [ ] a js:UnzipFile; 
                js:input <jr>;
                js:output <jw>.
        `;

        const source: Source = {
            value: pipeline + proc,
            baseIRI,
            type: "memory",
        };

        const { processors, quads, shapes: config } = await extractProcessors(source);
        const sub = processors.find((x) => x.ty.value.endsWith("UnzipFile"))!;
        
        expect(sub).toBeDefined();
        const argss = extractSteps(sub, quads, config);
        expect(argss.length).toBe(1);
        expect(argss[0].length).toBe(2);

        const [[input, output]] = argss;
        testReader(input);
        testWriter(output);

        await checkProc(sub.file, sub.func);
    });

});

function testReader(arg: any) {
    expect(arg).toBeInstanceOf(Object);
    expect(arg.channel).toBeDefined();
    expect(arg.channel.id).toBeDefined();
    expect(arg.ty).toBeDefined();
}

function testWriter(arg: any) {
    expect(arg).toBeInstanceOf(Object);
    expect(arg.channel).toBeDefined();
    expect(arg.channel.id).toBeDefined();
    expect(arg.ty).toBeDefined();
}

async function checkProc(location: string, func: string) {
    const mod = await import("file://" + location);
    expect(mod[func]).toBeDefined();
}