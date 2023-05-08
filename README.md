# PRELECT Core

This is an attempt at an implementation of the PRELECT programming langauge in raw WebAssembly.

Everything is being written first in modern ecmascript for rapid and readable affirmation of the concepts, then written again in WebAssembly Text that's to behave identically.

## PRELECT Memory Model

The strictly tabular and relational nature of PRELECT requires a strictly tabular and relational memory management model.

### Heap Allocation

The first position (0) in memory is the address of a clean and clear location for the next Table Definition, Instance Definition, Chunk Definition, or Chunk Dump. The second position (1) is a pointer to the first Table Instance. The first Table Definition begins on the third position (2).

Table Definitions are in a linked list, with the first position in the Table Definition pointing to the next one. The canonical name of the Table Definition is its order in that linked list. Instance Definitions exist in a tree from the first Instance Definition, with new instances defined when an instance instantiates another instance with the addition of a field defined by a defined table.

Table Definitions are defined at compile time while Instance Definitions and their respective Chunk Definitions and Chunk Dumps are created, modified, and destroyed during runtime.

| Position | Purpose                         |
| -------- | ------------------------------- |
| 0x64     | Clear location                  |
| 1x64     | pointer to first Table Instance |
| 2 - 7    | reserved                        |
| 8        | first Table Definition          |

#### Table Definition

The ninth position (8) in memory is the first Table Definition. Table definitions are abstract and are not associated with any data. An Instance Definition must be defined with a Table Definition with its parent, with the Instance Definition pointing to a list of Chunk Definitions that point to Chunk Dumps.

The names of tables and rows don't exist at this level, with tables and rows defined by the order in which they're defined. There are no strings at this level, only unsigned integers and floats.

| Position | Purpose                              |
| -------- | ------------------------------------ |
| Ax64     | pointer to next Table Definition     |
| Cx64     | number of rows                       |

After the table definition is the list of row definitions.

| Position | Purpose                           |
| -------- | --------------------------------- |
| Ax64     | Type / Formula Pointer            |
| Bx64     | Settings (nullable, mutable, etc) |

If the type definition (ax64) is 0-7, then it's one of the primitives. If the number is higher than that, then it's a reference to an Instance Definition that defines the native or custom type. The table in question may meet the criteria of a formula, query, prelect, or custom type.

| Type ID | Bits | Type    |
| ------- | ---- | ------- |
| 0       | 1    | boolean |
| 1       | 8    | uint8   |
| 2       | 16   | uint16  |
| 3       | 32   | uint32  |
| 4       | 64   | uint64  |
| 5       | 32   | f32     |
| 6       | 64   | f64     |
| 7       | 128  | v128    | 

Only primitive type definitions store data, with all other types referencing tabular instances that can store primitive types.

#### Instance Definition

The Instance Definition points to the Chunk Definition when there's data. This may not be the case, as all of the rows may be formulaic, meaning that the table is virtual. Potentially, it could store Chunk Definitions as cache at the discretion of the Optimizer.

| Position | Purpose                           |
| -------- | --------------------------------- |
| Ax64     | pointer to table definition       |
| Bx64     | pointer to first Chunk Definition |

#### Chunk Definition

Chunk definitions exist on a spectrum from full chunks at the maximum size of a chunk (2^16) down to highly fragmented linked lists that point to a single row of data.

The insertion and deletion process splices chunks, creating a linked list pointer to a chunk that then points back to the position in the dump after the change. The Optimizer can follow up and defragment the data, accounting for the usual trade-offs.

The idea is that when data is changing more, the memory looks more like a linked list and when it's being read more, it looks more like a smartly sorted hash table.

| Position | Purpose                            |
| -------- | ---------------------------------- |
| Ax64     | pointer to next Chunk Definition   |
| Bx64     | pointer to Chunk Dump              |
| Cx16     | chunk length                       |
| Cx8      | cluster length (power of 2)        |

#### Chunk Dump

| Position | Purpose              |
| -------- | -------------------- |
| Ax1      | commit flag (by row) |
| Ax1      | null flag (by field) |
| Ax??     | Data dump            |

The cluster length determines whether the data is sorted by column or by row. For write performance, sorting by the row is superior. For read performance, sorting by column is superior. A cluster length of 1 means that data is entirely sorted by row. If the cluster length can be increased enough, then parallel operations are much faster.

### Optimization and Garbage Collection 

The basic Memory Management implementation will grow and fragment however it needs to in order to store data being written as rapidly as possible. After it's implemented and tested to work without error, the Optimizer will be implemented, performing the job of reordering data to be less fragmented, garbage collecting instances that are no longer called by their parent, caching virtual table data, and generating indexes (both explicitly and automatically).