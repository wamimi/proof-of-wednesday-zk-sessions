# 2. Notes (UTXOs): Aztec's Private Money

**Analogy**: Notes are like encrypted digital cash or individual, sealed envelopes containing value, rather than a public bank account balance.

Private state in Aztec is managed using **Notes**, which are essentially Unspent Transaction Outputs (UTXOs).

## What are Notes?
*   Encrypted pieces of data that can only be decrypted by their owner(s).
*   Each note specifies its owner. Unlike account-based models (e.g., Ethereum accounts), there's no direct link between a user's "account" and the data's location in a tree.
*   Instead of storing entire notes directly in a public data tree, **note commitments** (hashes of the notes) are stored in a Merkle tree called the **note hash tree**.
*   When users want to use a note (e.g., spend it), they provide a proof that they have the pre-image information for the note commitment without revealing the note itself.

## How Notes Work
1.  **Creation**: A new note is created, encrypted for its owner. Its commitment is added to the note hash tree.
2.  **Spending/Updating**:
    *   The original note's commitment is **nullified** (invalidated) by creating a nullifier derived from the note data.
    *   New notes may be created (e.g., a change note for the original owner, and a payment note for a recipient).
    *   This decouples the actions of creating, updating, and "deleting" private state.

**Example - Spending a Note**: Imagine you have a private $5 note. You want to pay someone $3.50.
*   You nullify your $5 note.
*   You create a new $1.50 note for yourself (change).
*   You create a new $3.50 note for the recipient.
*   Crucially, an outside observer cannot link your original $5 note to the $3.50 payment or the $1.50 change. Only you and the recipient are aware of the $3.50 transaction details.

## Sending Notes
There are a few ways to get a note to its intended recipient:
1.  **On-chain (Encrypted Logs)**: The most common method. Encrypted note data is posted on-chain as part of a transaction. The recipient can then discover and decrypt it.
2.  **Off-chain (Out of Band)**: If you know the recipient directly, you can share the note data with them privately (e.g., over a secure chat).
3.  **Self-created Notes**: If you create a note for yourself (e.g., a change note), you don't need to broadcast it. You keep it in your Private Execution Environment (PXE).

## Abstraction with Aztec.nr
*   Users typically don't interact with individual notes directly.
*   The `Aztec.nr` smart contract library abstracts this complexity. Developers can define **custom note types** and how they are handled.
*   Users see their aggregated asset balances (e.g., "You have 10 PrivateDAI"), similar to an Ethereum account experience.
*   `Aztec.nr` also helps with **note discovery** (finding all notes encrypted for a user's account).

## Diagram: Note Lifecycle
```mermaid
graph TD
    subgraph User A's PXE (Private)
        N1_5["Note: $5 (Owned by A)"]
    end

    subgraph Aztec Network (Public Trees)
        NC1_5["Commitment(Note $5)"]
        NullSet["Nullifier Set"]
    end

    subgraph User B's PXE (Private)
        N2_35["Note: $3.5 (Owned by B)"]
    end
    
    subgraph User A's PXE (Private)
        N3_15["Note: $1.5 (Owned by A)"]
    end

    N1_5 --"1. User A decides to spend $3.50"--> P1{Process Transaction};
    P1 --"2. Nullify $5 Note"--> AddNullifier;
    AddNullifier["Add Nullifier(Note $5)"] --> NullSet;
    NC1_5 -.-> AddNullifier;
    
    P1 --"3. Create new $3.50 note for B"--> N2_35;
    P1 --"4. Create new $1.50 note for A (change)"--> N3_15;

    N2_35 --> NC2_35["Commitment(Note $3.5)"];
    N3_15 --> NC3_15["Commitment(Note $1.5)"];

    NC2_35 & NC3_15 --> NoteHashTable[Note Hash Tree]
```

## Why it Matters for Developers
*   Notes are the fundamental building blocks of private assets and state in Aztec.
*   Understanding how to define and manage custom note types in `Aztec.nr` is key to building applications.
*   The concept of nullifiers is central to preventing double-spends and managing private state changes. 