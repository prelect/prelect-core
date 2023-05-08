import fs from "fs";
import Wabt from "wabt";

export default class PrelectCore {
  constructor() {
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

    this.mem[0n] = 8n; // free space pointer (0 if locked)
    this.mem[1n] = 0n; // last table pointer

    // this.createTable();
    this.createTable([Prim.i1]);
    this.createTable([Prim.i1]);
    this.createTable([Prim.i1]);
    this.createTable([Prim.i1]);
  
    console.log(this.mem.slice(0, 64));
  }

  createTable(fields = []) {
    if (fields.length === 0) throw new Error("table must have at least one field");

    // wait if locked
    if (this.mem[0n] !== 0) this.hang();

    // table start at free space
    let cursor = this.mem[0n]; 
    // lock while calculating next free space
    this.mem[0n] = 0n;
    // this table is last table now
    this.mem[this.mem[1n]] = cursor;
    this.mem[1n] = cursor;
    // determine location of next space, unlocking
    this.mem[0n] = cursor + 2n + (2n * BigInt(fields.length));

    this.mem[cursor + 1n] = BigInt(fields.length);

    let rowLength = 0n;
    fields.forEach((field) => rowLength += field.bits);
    
    this.mem[this.mem[1n] + 5n] = rowLength;

    fields.forEach((field, i) => {
      // mutable? nullable? locked? reordered? deleted?
      this.mem[cursor + 2n + 2n * BigInt(i) + 0n] = 997n;
      this.mem[cursor + 2n + 2n * BigInt(i) + 1n] = field.type;
    });

    return cursor;
  }

  insert(table, offset, size) {
    if (offset + size > this.mem.length) {
      this.defrag();
      this.insert(table, offset, size);
    }

    this.mem[table + 2n]    
  }

  update(table, row, data) {}

  read(table, columns = [], rowFirst, rowFinal, committed = true) {
    if (committed) this.sync();
  }

  delete(table, row) {}

  dropTable(table) {}

  sync() {}

  defrag() {
    sync();
    throw new Error("memory overflow");
  }

  // TODO: how to wait in wasm?
  hang() {}
}

class TableField {
  constructor(type, nullable, mutable) {
    this.type = type;
    this.nullable = nullable;
    this.mutable = mutable;
  }
}

const Prim = {
  i1: {
    order: 0,
    type: 1n,
    bits: 1n,
    cast: Boolean,
  },

  i8: {
    order: 1,
    type: 2n,
    bits: 8n,
    cast: Uint8Array,
  },

  i16: {
    order: 2,
    type: 3n,
    bits: 16n,
    cast: Uint16Array,
  },

  i32: {
    order: 3,
    type: 4n,
    bits: 32n,
    cast: Uint32Array,
  },

  i64: {
    order: 4,
    type: 6n,
    bits: 64n,
    cast: BigUint64Array,
  },

  f32: {
    order: 5,
    type: 5n,
    bits: 32n,
    cast: Float32Array,
  },

  f64: {
    order: 6,
    type: 7n,
    bits: 64n,
    cast: Float64Array,
  },

  v128: {
    order: 7,
    type: 8n,
    bits: 128n,
    cast: null, // BigInt.asUintN(128, ?)
  },
};

const prelectCore = new PrelectCore();
