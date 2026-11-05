# file-utils-processors-ts

[![Build and tests with Node.js](https://github.com/rdf-connect/file-utils-processors-ts/actions/workflows/build-test.yml/badge.svg)](https://github.com/rdf-connect/file-utils-processors-ts/actions/workflows/build-test.yml) [![npm](https://img.shields.io/npm/v/@rdfc/file-utils-processors-ts.svg?style=popout)](https://npmjs.com/package/@rdfc/file-utils-processors-ts)

This repository provides a set of processors for reading, transforming, and extracting files in RDF-Connect pipelines.  
It includes utilities for reading files from folders or glob patterns, substituting strings or environment variables, reading files on demand, and handling compressed files (zip/gzip).

These processors are designed to integrate seamlessly into RDF-Connect pipelines using the [rdfc:NodeRunner](https://github.com/rdf-connect/js-runner).

---

## Usage

To use these processors, import the package into your RDF-Connect pipeline configuration and reference the required processors.

### Installation

```bash
npm install
npm run build
```

Or install from NPM:

```bash
npm install @rdfc/file-utils-processors-ts
```

Next, you can add the processors to your pipeline configuration as follows:

```turtle
@prefix rdfc: <https://w3id.org/rdf-connect#>.
@prefix rdfcp: <https://w3id.org/rdf-connect/processors#>.
@prefix owl: <http://www.w3.org/2002/07/owl#>.

### Import the processor definitions
<> owl:imports <./node_modules/@rdfc/file-utils-processors-ts/processors.ttl>.

### Define the channels your processor needs
<in> a rdfc:Reader, rdfc:Writer.
<out> a rdfc:Reader, rdfc:Writer.

### Attach the processor to the pipeline under the NodeRunner
# Add the `rdfc:processor <folderReader>` statement under the `rdfc:consistsOf` statement of the `rdfc:NodeRunner`

### Define and configure the processors
<folderReader> a rdfcp:FolderRead;
    rdfcp:folder_location "./data";
    rdfcp:file_stream <out>.
```

---

## Processors and Configuration

### 📂 `rdfcp:GlobRead` – Glob-based File Reader

Reads all files matching a given glob pattern.

**Parameters:**

- `rdfcp:glob` (`string` or IRI, required): Glob pattern to select files.
- `rdfcp:output` (`rdfc:Writer`, required): Output channel to stream file contents.
- `rdfcp:wait` (`integer`, optional, default `0`): Delay (ms) before reading files.
- `rdfcp:closeOnEnd` (`boolean`, optional, default `true`): Whether to close the stream after finishing.
- `rdfcp:binary` (`boolean`, optional, default `false`): If true, streams binary data instead of text.

---

### 📁 `rdfcp:FolderRead` – Folder File Reader

Reads all files inside a folder.

**Parameters:**

- `rdfcp:folder_location` (`string` or IRI, required): Path to the folder.
- `rdfcp:file_stream` (`rdfc:Writer`, required): Output channel to stream file contents.
- `rdfcp:max_memory` (`double`, optional, default `3`): Max heap memory usage allowed (in GB) before pausing.
- `rdfcp:pause` (`integer`, optional, default `5000`): Pause duration (ms) between file reads.

---

### 🔄 `rdfcp:Substitute` – String Substitution Processor

Performs string substitution (supports regex) on messages in the stream.

**Parameters:**

- `rdfcp:input` (`rdfc:Reader`, required): Input channel.
- `rdfcp:output` (`rdfc:Writer`, required): Output channel.
- `rdfcp:source` (`string`, required): Source string or regex to match.
- `rdfcp:replace` (`string`, required): Replacement string.
- `rdfcp:regexp` (`boolean`, optional, default `false`): If true, treat `source` as a regex.

---

### 🌍 `rdfcp:Envsub` – Environment Variable Substitution

Substitutes environment variables in the stream with their values.

**Parameters:**

- `rdfcp:input` (`rdfc:Reader`, required): Input channel.
- `rdfcp:output` (`rdfc:Writer`, required): Output channel.

---

### 📄 `rdfcp:ReadFile` – On-Demand File Reader

Reads a requested file from a given folder.

**Parameters:**

- `rdfcp:input` (`rdfc:Reader`, required): Input channel (file requests).
- `rdfcp:folderPath` (`string` or IRI, required): Path to the folder containing files.
- `rdfcp:output` (`rdfc:Writer`, required): Output channel for file contents.

---

### 📦 `rdfcp:UnzipFile` – Zip File Extractor

Unzips a compressed file and streams its content.

**Parameters:**

- `rdfcp:input` (`rdfc:Reader`, required): Input channel (zip file).
- `rdfcp:output` (`rdfc:Writer`, required): Output channel (extracted contents).

---

### 🗜️ `rdfcp:GunzipFile` – Gzip File Extractor

Gunzip a compressed file stream and stream out its content. This processor operates only in streaming mode.

**Parameters:**

- `rdfcp:input` (`rdfc:Reader`, required): Input channel (gzip file).
- `rdfcp:output` (`rdfc:Writer`, required): Output channel (extracted contents).

---

### 📝 `rdfcp:FileWriter` – JavaScript File Writer

Writes incoming data to a file. Supports writing buffered strings, binary buffers, or streaming input.

**Parameters:**

- `rdfcp:input` (`rdfc:Reader`, required): Input channel providing data to write. Can be strings, buffers, or streams depending on configuration.
- `rdfcp:filePath` (`string` or IRI, required): Destination file path where data will be written.
- `rdfcp:readAsStream` (`boolean`, optional, default `false`): If true, consume the inputs as streams and pipe them to the destination file. Use this for large files or streaming data.
- `rdfcp:binary` (`boolean`, optional, default `false`): If true, treat incoming messages as binary buffers and write them as binary data. When false or omitted, input strings will be written as UTF-8 text.

Notes:

- When `readAsStream` is true, the processor opens a single write stream to the specified `filePath` and writes chunks from every incoming stream into that same file handle. The stream is opened once (which will truncate/overwrite the file at open time) and is ended after all incoming streams have been consumed. This effectively concatenates multiple incoming streams into a single file.
- When `readAsStream` is false (the default), each incoming message (string or buffer) is appended to the target file using Node.js `appendFile`, so messages are concatenated in the order they arrive. The file will be created if it doesn't exist. If you need to overwrite the file instead, either truncate it before use or use streaming mode (which opens/truncates the file once at start).

Example (streaming mode):

```turtle
<writer> a rdfcp:FileWriter;
    rdfcp:input <in>;
    rdfcp:filePath "./out/output.txt";
    rdfcp:readAsStream true.
```

Example (buffered text mode):

```turtle
<writer> a rdfcp:FileWriter;
    rdfcp:input <in>;
    rdfcp:filePath "./out/output.txt";
    rdfcp:readAsStream false;
    rdfcp:binary false.
```

## Example Pipelines

### Example 1: Reading all `.txt` files in a folder and logging them

```turtle
<reader> a rdfcp:GlobRead;
rdfcp:glob "./data/*.txt";
rdfcp:output <out>.

<logger> a rdfcp:LogProcessorJs;
    rdfcp:reader <out>;
    rdfcp:level "info";
    rdfcp:label "glob-reader".
```

### Example 2: Substituting strings in a stream

```turtle
<substitute> a rdfcp:Substitute;
rdfcp:reader <in>;
rdfcp:writer <out>;
rdfcp:source "World";
rdfcp:replace "RDF-Connect";
rdfcp:regexp false.
```

### Example 3: Reading and unzipping a file

```turtle
<unzipper> a rdfcp:UnzipFile;
rdfcp:reader <in>;
rdfcp:writer <out>.
```
