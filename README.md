# PRELECT Core

This PRELECT Core repository is where the development of the compiler takes place. The command line interface, the bindings to the ANTLR parsing tree, and the interface with the language server and debugger are implemented in the PRELECT repository. The intention is that this will eventually become a submodule of the PRELECT repository.

PRELECT Core is being designed in both Javascript and WebAssembly Text. This is so that ideas can be prototyped and tested first in Javascript before the laborious translation of those ideas into assembly code.

## PRELECT Memory Model

The first eight 64-bit positions (0-7) of the heap are reserved, with the first three reserved for pointers to the first free memory block, the first table definition, and the first instance definition.

| Position | Purpose                              |
| -------- | ------------------------------------ |
| 0x64     | pointer to first Free Definition     |
| 1x64     | pointer to first Table Definition    |
| 2x64     | pointer to first Instance Definition |
| 3-7      | reserved                             |

The Free Definition is a linked list with each node describing the location and size, and status of an area of free memory. The Table Definition is a linked list with each node describing the structure of relational tables. Instance Definitions are instances of tables. It exists in a tree pattern, begin with a root instance from which all other instances are derived.

### Free Definition

This is a linked list containing the location and size of all free memory ranges. In the beginning, it is a single definition with a size inclusive of the rest of the memory allocated. With every new memory allocation, it shrinks or divides into multiple ranges.

New attempts to allocate memory travel the linked list until they find a minimum size equal to or greater than their minimum requirement.

| Position | Purpose                         |
| -------- | ------------------------------- |
| 0x64     | pointer to next Free Definition |
| 1x64     | pointer to first open space     |
| 2x64     | size (64 bit)                   |

### Table Definition

Table definitions are abstract and are not associated with any data. The "names" of tables and rows don't exist at this level, with tables and rows defined by the order in which they're defined. There are no strings at this level, only unsigned integers and floats.

| Position | Purpose                              |
| -------- | ------------------------------------ |
| Ax64     | pointer to next Table Definition     |
| Cx64     | number of rows                       |

After the table definition is the list of row definitions.

| Position | Purpose                           |
| -------- | --------------------------------- |
| Ax64     | Type / Formula Pointer            |
| Bx64     | Settings (nullable, mutable, etc) |

If the type definition (Ax64) is 0-7, then it's one of the primitives. If the number is higher than that, then it's a reference to an Instance Definition that defines the native or custom type. The table in question may meet the criteria of a formula, query, prelect, or custom type.

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

### Instance Definition

The "tables" defined above are abstract classes, while the "instances" contain the data. There are several special kinds of table (everything is a table!) with special properties, including prelects, prelect hatches, formulas, and queries.

All of the instances defined in parent instances are accessible to child instances. If a child wishes to modify an instance that it's inherited, then it:

1. Waits until the inherited instance is unlocked
2. Locks the inherited instance
3. Creates a new Instance Definition in its linked list
4. Bx64 is set to the address of the original
5. Ex1 is set to locked
6. Copies all the Chunk Definitions, creating new linked list
7. Makes the changes to the Chunk Definitions and Chunk Dumps
8. Ex1 is set to unlocked
9. When the instance resolves, replace the parent Instance Definition with the new one.

A concurrent thread can read a "locked" instance, but won't see the new changes until the instance has resolved. In SQL terms, every hatch and statement is an atomic transaction that won't show any changes to any tables until the transaction is completed successfully.

Statements which are read-only disregard the lock variable, while statements that contain mutation formulas queue up when a table is locked in order to ensure that there aren't conflicting writes. This has performance implications, with the advice being to segregate code that reads from code that writes as much as possible.

If Ax64 equals itself, then it's the canonical (root) instance of itself.

| Position | Purpose                                  |
| -------- | ---------------------------------------- |
| Ax64     | pointer to canonical Instance Definition |
| Bx64     | pointer to Table Definition              |
| Cx64     | pointer to first Chunk Definition        |
| Dx64     | settings (locked, etc)                   |

### Chunk Definition

Chunk definitions are nodes in a linked list that exist on a spectrum from full chunks at the maximum size of a chunk (2^16) down to highly fragmented nodes that can point to a single row of data.

The insertion and deletion process splices chunks, creating a linked list pointer to a chunk that then points back to the position in the dump after the change. The Optimizer can follow up and defragment the data, accounting for the usual trade-offs.

The idea is that when data is changing more, the memory looks more like a linked list and when it's being read more, it looks more like a smartly sorted hash table.

| Position | Purpose                          |
| -------- | -------------------------------- |
| Ax64     | pointer to next Chunk Definition |
| Bx64     | pointer to Chunk Dump            |
| Cx16     | chunk size                       |
| Dx16     | chunk length                     |
| Ex16     | cluster length                   |
| Fx16     | etc (timestamp? committed?)      |

### Chunk Dump

| Position | Purpose              |
| -------- | -------------------- |
| Ax1      | null flag (by field) |
| Ax??     | Data dump            |

The cluster length determines whether the data is sorted by column or by row. For write performance, sorting by the row is superior. For read performance, sorting by column is superior. A cluster length of 1 means that data is entirely sorted by row. If the cluster length can be increased enough, then parallel operations are much faster.

## Optimization and Garbage Collection 

The threads for the instances write as rapidly as possible but perform no optimization. A separate thread which runs concurrently with the others is the optimization thread. Its goals are:

1. Don't obstruct other threads
2. Defragment the chunks
3. Defragment the definitions
4. Create ephemeral indices
5. Release memory

The Optimizer will need to account for several factors, and will not be implemented until the rest of the compiler is far enough along that its development can be performed with proper profiling to test the hypotheses about the various factors and trade-offs.