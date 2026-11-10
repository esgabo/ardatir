// gltfpack ships no types; this is the one function scripts/models/pack.ts uses.
declare module 'gltfpack' {
  export function pack(
    args: string[],
    iface: { read(path: string): Uint8Array; write(path: string, data: Uint8Array): void },
  ): Promise<string>;
}
