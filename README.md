# PRELECT Core
WebAssembly module implementing PRELECT language

At this point, this amounts to a private playground for learning
about low level webassembly and memory management stuff.

The idea is to prototype it in js then hand-translate it to WebAssembly.

## Primitives

Internally, PRELECT is comprised entirely of tables of one of seven primitive "types" that correspond with wasm primitives. More complex types are derived from these tables. A scalar variable is a table comprised of a single column and row.

| Index | Type | Description             |
|:-----:|:----:|-------------------------|
|   0   | NULL | deleted                 |
|   1   | i1   | unsigned 1 bit integer  |
|   2   | i8   | unsigned 8 bit integer  |
|   3   | i16  | unsigned 16 bit integer |
|   4   | i32  | unsigned 32 bit integer |
|   5   | f32  | unsigned 32 bit float   |
|   6   | i64  | unsigned 64 bit integer |
|   7   | f64  | unsigned 64 bit float   |

The index number is 64 bit because the type can also point to custom type or formula addresses for more advanced behavior.

## Memory Model

The goal with PRELECT is to achieve a table-oriented memory model.

| Address | Purpose            |
|:-------:|--------------------|
| 0x64    | free space pointer |
| 1x64    | last table pointer |

The first address points to where it can go to write a new table or data range.

The second address points to where the last table definition begins.

The third address is where the first table definition begins:

| Address | Purpose |
|:-------:|---------|
| Ax64    | Pointer to next table (zero if final) |
| Bx64    | Point to parent (inherit fields)      |
| Cx64    | Point to data                         |
| Dx64    | Number of fields                      |

Each table entry's first value is a pointer to the next table, creating a linked list.

After those fields, there are two 64 bit fields apiece for each
field/row of the table.

| Ex64    | Settings. Mutable? Nullable? Etc |
| Fx64    | Field type or pointer to formula |