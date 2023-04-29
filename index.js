import fs from "fs";
import Wabt from "wabt";

export default class PrelectCore {
  constructor() {
    this.prim = {
      i1: {
        type: 1n,
        bits: 1,
        cast: Boolean
      },
      i8: {
        type: 2n,
        bits: 8,
        cast: Uint8Array
      },
      i16: {
        type: 3n,
        bits: 16,
        cast: Uint16Array
      },
      i32: {
        type: 4n,
        bits: 32,
        cast: Uint32Array
      },
      f32: {
        type: 5n,
        bits: 32,
        cast: Float32Array
      },
      i64: {
        type: 6n,
        bits: 64,
        cast: BigUint64Array
      },
      f64: {
        type: 7n,
        bits: 64,
        cast: Float64Array
      },
      v128: {
        type: 8n,
        bits: 128,
        cast: BigInt.asUintN(128, 0n)
      },
    };

    return this.init();
  }

  async init() {
    this.wabt = await Wabt();
    this.wat = fs.readFileSync("prelect.wat", { encoding: "utf8" });
    this.wasm = this.wabt.parseWat("prelect.wat", this.wat);

    this.buffer = this.wasm.toBinary({
      log: false,
      write_debug_names: true,
    }).buffer;

    this.module = await WebAssembly.instantiate(this.buffer);
    console.debug("module instantiated");

    this.pltmem = this.module.instance.exports.pltmem;
    this.plttbl = this.module.instance.exports.plttbl;

    this.mem = new BigUint64Array(this.pltmem.buffer);

    this.mem[0n] = 2n; // free space pointer
    this.mem[1n] = 0n; // last table pointer

    this.createTable([this.prim.i64, this.prim.f32]);
  
    console.log(this.mem.slice(0, 64));
  }

  // if it has a parentTable, it's an index
  createTable(fields = [], parentTable = 0n) {
    if (this.mem[0n] + 4n + BigInt(fields.length * 2) > this.mem.length) {
      // TODO: grow memory when overflow
      // try defrag before grow
      throw new Error("memory overflow");
    }

    // TODO: handle if more than 64 bit number of fields?
    if (fields.length >= 2n ** 64n) {
      throw new Error("table field # overflow");
    }

    // pointer to new table
    if (this.mem[1n] !== 0) {
      this.mem[this.mem[1n]] = this.mem[0n];
    }

    this.mem[1n] = this.mem[0n];

    // parent table pointer
    this.mem[this.mem[1n] + 1n] = parentTable;

    // data pointer
    this.mem[this.mem[1n] + 2n] = 0n;

    // number of fields
    if (parentTable > 0) {
      this.mem[this.mem[1n] + 3n] = this.mem[parentTable + 3n];
    } else {
      this.mem[this.mem[1n] + 3n] = BigInt(fields.length);
    }

    fields.forEach((field, i) => {
      i = BigInt(i);
      // mutable? nullable? locked? reordered? deleted?
      this.mem[this.mem[1n] + 4n + 2n * i + 0n] = 997n;

      if (parentTable > 0) {
        // order
        this.mem[this.mem[1n] + 4n + 2n * i + 1n] = field;
      } else {
        // type (or formula address)
        this.mem[this.mem[1n] + 4n + 2n * i + 1n] = field.type;
      }
    });

    // move cursor forward
    this.mem[0n] = this.mem[1n] + 4n + BigInt(fields.length) * 2n;

    return this.mem[1n];
  }

  insert(table, data) {}

  update(table, row, data) {}

  read(table, columns, rowFirst, rowFinal) {}

  delete(table, row) {}

  dropTable(table) {}
}

const prelectCore = new PrelectCore();