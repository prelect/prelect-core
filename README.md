# PRELECT Core
WebAssembly module implementing PRELECT language

At this point, this amounts to a private playground for learning
about low level webassembly and memory management stuff.

## Primitives

Internally, PRELECT is comprised entirely of tables of one of seven primitive "types" that correspond with wasm primitives. More complex types are derived from these tables. A scalar variable is a table comprised of a single column and row.

| Index | Type | Description             |
|:-----:|:----:|-------------------------|
|   1   | i1   | unsigned 1 bit integer  |
|   2   | i8   | unsigned 8 bit integer  |
|   3   | i16  | unsigned 16 bit integer |
|   4   | i32  | unsigned 32 bit integer |
|   5   | f32  | unsigned 32 bit float   |
|   6   | i64  | unsigned 64 bit integer |
|   7   | f64  | unsigned 64 bit float   |

## Memory

WASM memory is allocated in 64kib (1000 * i64) blocks.

As such, the first block is special, with data storage beginning at the zero
address and growing until it reaches the 500th address (halfway point). At that point,
it requests a block that's twice its current size (a full block), doubling
with each growth step.

This leaves the second half of the first memory block for storing the
information about the size and shape of those pages.

### Section One

These numbers are used to perform the calculation necessary to find the data.

This calculation is complex because different buckets grow at different rates.

With each subsequent page, the size of the page grows.

    0x0xi64 - number of indexes
    0x1xi64 - number of pages: i1
    0x2xi64 - number of pages: i8
    0x3xi64 - number of pages: i16
    0x4xi64 - number of pages: i32
    0x5xi64 - number of pages: f32
    0x6xi64 - number of pages: i64
    0x7xi64 - number of pages: f64

## - Section Two - Index of Indexes

This section contains a list of the indexes, their columns, and their types. 

1x1xi64 - table_id (addr for table, not index)
1x2xi64 - number of rows

# - Section Three - Index of Rows

2x1xi64 - type_id if table, order_id if index

# - Section Four - Data

The data is stored in a page, beginning with 128 rows per page and growing as the size of the data grows. Size depends on type.

3x1x??? - data