# file-utils-processors-ts

[![Bun CI](https://github.com/rdf-connect/file-utils-processors-ts/actions/workflows/build-test.yml/badge.svg)](https://github.com/rdf-connect/file-utils-processors-ts/actions/workflows/build-test.yml) [![npm](https://img.shields.io/npm/v/@rdfc/file-utils-processors-ts.svg?style=popout)](https://npmjs.com/package/@rdfc/file-utils-processors-ts)

[RDF-Connect](https://rdf-connect.github.io/rdfc.github.io/) Typescript processors for handling file operations. It currently exposes 6 functions:

### [`js:GlobRead`](https://github.com/rdf-connect/file-utils-processors-ts/blob/main/processors.ttl#L10)

This function relies on the [`glob`](https://www.npmjs.com/package/glob) library to select a set of files according to a shell expression and stream them out in a sequential fashion. A `wait` parameter can be defined to wait x milliseconds between file streaming operations.

### [`js:FolderRead`](https://github.com/rdf-connect/file-utils-processors-ts/blob/main/processors.ttl#L70)

This function reads all the files present in a given folder and streams out their content in a sequential fashion. A `maxMemory` parameter can be given (in GB) to defined threshold of maximum used memory by the streaming process. When the threshold is exceeded, the streaming process will pause for as many  milliseconds as defined by the `pause` parameter.

### [`js:Substitute`](https://github.com/rdf-connect/file-utils-processors-ts/blob/main/processors.ttl#L121)

This function transform a stream by applying a given string substitution on each of the messages. The matching string can be a regex defined by the `source` property and setting the `regexp` property to `true`.

### [`js:Envsub`](https://github.com/rdf-connect/file-utils-processors-ts/blob/main/processors.ttl#L185)

This function substitute all the defined environment variables on each of the elements of an input stream that have been labeled with a `${VAR_NAME}` pattern.

### [`js:ReadFile`](https://github.com/rdf-connect/file-utils-processors-ts/blob/main/processors.ttl#L220)

This function can read on demand and push downstream the contents of a file located in a predefined folder. This processor is used mostly for testing and demonstrating pipeline implementations.

### [`js:UnzipFile`](https://github.com/rdf-connect/file-utils-processors-ts/blob/main/processors.ttl#L265)

This function can receive a zipped file in the form of a Buffer and stream out its decompressed contents.
