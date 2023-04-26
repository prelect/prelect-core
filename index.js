import fs from "fs";
import Wabt from "wabt";

Wabt().then((wabt) => {
  const wat = fs.readFileSync("prelect.wat", { encoding: "utf8" });

  const wasm = wabt.parseWat("prelect.wat", wat);

  const { buffer } = wasm.toBinary({
    log: false,
    write_debug_names: true,
  });
  console.debug("module compiled");

  WebAssembly.instantiate(buffer).then((module) => {
    console.debug("module instantiated");
  });
});
