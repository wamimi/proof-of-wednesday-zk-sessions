# 1. State Model: The Two Worlds of Aztec

**Analogy**: Think of Aztec's state like a building with both public announcement boards and private, secure vaults.

Aztec features a **hybrid state model**, meaning it supports both public and private data and operations within its smart contracts.

## Public State
*   **What it is**: Transparent data, similar to what you find on Ethereum. Everyone can see it.
*   **How it works**: Managed by smart contract logic. The network's Sequencer executes public state changes, generates proofs of this execution, and publishes the associated data to Ethereum (L1).
*   **Analogy**: A public notice board in a town square. Anyone can read the notices, and updates are posted for all to see by the town crier (the Sequencer).

## Private State
*   **What it is**: Encrypted data "owned" by users (or a set of users through shared secrets). Only authorized individuals can decrypt and view it.
*   **How it works**:
    *   Stored in an append-only database. This means new data is added, but old data isn't directly changed or deleted in place, as that could leak information.
    *   "Deleting" private state: Achieved by creating a **nullifier**. This is like marking an old private note as "spent" without revealing its content.
    *   Modifying private state: You nullify the old state record (e.g., an old note) and create a new one with the updated information. This gives private state an intrinsic **UTXO (Unspent Transaction Output) structure**.
*   **Analogy**: A personal, magically sealed diary (or a secure vault). Only you have the key. When you update an entry, you write a new one and magically mark the old one as "outdated" (nullified) in a way that doesn't reveal what the old entry was.

## Diagram: Public vs. Private State
```mermaid
graph TD
    A[Aztec Network] --> B{State Model};
    B --> C[Public State];
    B --> D[Private State];

    C --> C1[Transparent Data];
    C --> C2[Managed by Sequencer];
    C --> C3[Published to Ethereum];

    D --> D1[Encrypted Data];
    D --> D2[Owned by Users];
    D --> D3[Append-only (UTXO-like)];
    D --> D4[Changes via Nullifiers + New Notes];
```

## Why it Matters for Developers
*   You can design applications with both transparent public interactions and confidential private user data.
*   Understanding the append-only nature of private state and the role of nullifiers is crucial for managing private data lifecycles. 