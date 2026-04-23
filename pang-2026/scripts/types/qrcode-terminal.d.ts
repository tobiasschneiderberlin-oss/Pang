// Minimal ambient type for the qrcode-terminal package — upstream
// ships no .d.ts and @types/qrcode-terminal doesn't exist. The
// surface we actually use is the `generate(input, opts, cb)` form.
declare module "qrcode-terminal" {
  const qrcodeTerminal: {
    generate(
      input: string,
      opts: { small?: boolean },
      cb: (ascii: string) => void,
    ): void;
  };
  export default qrcodeTerminal;
}
