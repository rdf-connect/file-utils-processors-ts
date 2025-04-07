import { Processor, reexports } from "@rdfc/js-runner";

export type GetMyClassT<C extends Processor<unknown>> = C extends Processor<infer T>  ? T & C : unknown;
export class TestClient extends reexports.RunnerClient {
  next: (stream: reexports.ClientReadableStream<reexports.DataChunk>) => unknown

  constructor() {
    super('localhost:5400', reexports.grpc.credentials.createInsecure())
  }

  nextStream(): Promise<reexports.ClientReadableStream<reexports.DataChunk>> {
    return new Promise((res) => (this.next = res))
  }

  receiveStreamMessage(): reexports.ClientReadableStream<reexports.DataChunk> {
    const stream = new reexports.ClientReadableStreamImpl<reexports.DataChunk>((data: Buffer) => {
      console.log('Debug', data)
      return { data }
    })
    this.next(stream)
    return stream
  }
}

export async function one<T>(iter: AsyncIterable<T>): Promise<T | undefined> {
  for await (const item of iter) {
    return item
  }
}
