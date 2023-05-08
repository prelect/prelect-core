import fs from "fs";
import Wabt from "wabt";

export default class PrelectCore {
  constructor() {
    this.prim = {
      i1: {
        order: 0,
        type: 1n,
        bits: 1n,
        cast: Boolean
      },
      i8: {
        order: 1,
        type: 2n,
        bits: 8n,
        cast: Uint8Array
      },
      i16: {
        order: 2,
        type: 3n,
        bits: 16n,
        cast: Uint16Array
      },
      i32: {
        order: 3,
        type: 4n,
        bits: 32n,
        cast: Uint32Array
      },
      i64: {
        order: 4,
        type: 6n,
        bits: 64n,
        cast: BigUint64Array
      },
      f32: {
        order: 5,
        type: 5n,
        bits: 32n,
        cast: Float32Array
      },
      f64: {
        order: 6,
        type: 7n,
        bits: 64n,
        cast: Float64Array
      },
      v128: {
        order: 7,
        type: 8n,
        bits: 128n,
        cast: null // BigInt.asUintN(128, ?)
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

    this.createTable(0n, 0n, [this.prim.i64, this.prim.f32]);
    this.createTable(0n, 0n);
    this.createTable(0n, 0n, [this.prim.i8]);
  
    console.log(this.mem.slice(0, 64));
  }

  // if it has a parentTable, it's an index
  createTable(callingTable = 0n, parentTable = 0n, fields = []) {
    if (this.mem[0n] + 4n + BigInt(fields.length * 2) > this.mem.length) {
      this.defrag();
      this.createTable(fields, parentTable);
      // TODO: grow memory when overflow
      // try defrag before grow
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

    // calling table pointer
    this.mem[this.mem[1n] + 1n] = callingTable;

    // parent table pointer
    this.mem[this.mem[1n] + 2n] = parentTable;

    // data pointer
    this.mem[this.mem[1n] + 3n] = 0n;

    // number of fields
    if (parentTable > 0) {
      this.mem[this.mem[1n] + 4n] = this.mem[parentTable + 3n];
    } else {
      this.mem[this.mem[1n] + 4n] = BigInt(fields.length);
    }

    let rowLength = 0n;
    fields.forEach((field) => rowLength += field.bits);
    
    this.mem[this.mem[1n] + 5n] = rowLength;


    fields.forEach((field, i) => {
      i = BigInt(i);
      // mutable? nullable? locked? reordered? deleted?
      this.mem[this.mem[1n] + 6n + 2n * i + 0n] = 997n;

      if (parentTable > 0) {
        // order
        this.mem[this.mem[1n] + 6n + 2n * i + 1n] = field;
      } else {
        // type (or formula address)
        this.mem[this.mem[1n] + 6n + 2n * i + 1n] = field.type;
      }
    });

    // move cursor forward
    this.mem[0n] = this.mem[1n] + 6n + BigInt(fields.length) * 2n;

    return this.mem[1n];
  }

  insert(table, offset, size) {
    if (offset + size > this.mem.length) {
      this.defrag();
      this.insert(table, offset, size);
    }

    this.mem[table + 2n]    
  }

  update(table, row, data) {}

  read(table, columns, rowFirst, rowFinal, committed = true) {
    if (committed) this.sync();
  }

  delete(table, row) {}

  dropTable(table) {}

  sync() {}

  defrag() {
    sync();
    throw new Error("memory overflow");
  }
}

const prelectCore = new PrelectCore();