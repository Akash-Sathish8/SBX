// Bare `.wasm` imports resolve to a compiled WebAssembly.Module in the
// Cloudflare Workers / @cloudflare/vite-plugin environment (matching Workers'
// native behavior). vite/client only declares `*.wasm?init`, so this is safe.
declare module '*.wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
