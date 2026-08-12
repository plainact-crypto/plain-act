import { cp, copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir(resolve("public/stockfish"), { recursive: true });

for (const file of [
  "stockfish-18-lite-single.js",
  "stockfish-18-lite-single.wasm"
]) {
  await copyFile(
    resolve("node_modules/stockfish/bin", file),
    resolve("public/stockfish", file)
  );
}

await mkdir(resolve("public/cm-chessboard"), { recursive: true });
await cp(
  resolve("node_modules/cm-chessboard/assets"),
  resolve("public/cm-chessboard"),
  { recursive: true, force: true }
);

console.log("Chessboard assets and Stockfish 18 lite single-thread engine copied.");
