# Transaction Lifecycle in Aztec

**Core Idea**: Aztec transactions are fundamentally different from Ethereum's due to client-side proving for private components and the separation of private/public execution phases.

## Simple Private Transaction Lifecycle Example (e.g., Sending Private DAI)

1.  **User Initiates (in Wallet/DApp)**:
    *   User confirms an action, e.g., "privately send 10 DAI to `recipient.eth`".
    *   *Status*: The intent exists only within the user's client-side environment (e.g., [PXE](./../ExecutionEnvironment/PXE.md)).

2.  **PXE Executes Locally (Private Part Simulation & Proving)**:
    *   The PXE simulates the private function call (e.g., the `transfer` method on the private DAI token contract) using the user's private inputs (notes to spend, keys).
    *   It computes the state difference: which input notes to consume (and thus nullify), which new output notes to create (for the recipient and any change for the sender).
    *   The PXE then generates ZK-SNARK proofs for:
        *   Correct authorization (e.g., proof that the user approved this, often via their [Account Contract](./../AccountsAndAuth/Accounts.md) logic).
        *   Correct execution of the private `transfer` method according to the contract's circuit.
    *   *Status*: Proofs and public outputs (new note commitments, nullifiers) are generated locally. Private inputs never leave the PXE.

3.  **Transaction Sent to Network (via Aztec Node)**:
    *   The PXE sends the ZK proofs, new note commitments, nullifiers, and any requests for public function execution (if applicable) to an Aztec Node.
    *   *Status*: The transaction, or at least its private components and effects, is now known to an Aztec Node.

4.  **Sequencer Processing & Block Inclusion**:
    *   The Aztec Node relays the transaction to a Sequencer.
    *   The Sequencer:
        *   Validates the ZK proofs for the private execution part.
        *   If there are enqueued public functions, the Sequencer executes them. If these public functions require their own proofs (e.g., for complex state changes), the Sequencer might request these from a Prover network.
        *   Updates its local view of the L2 state trees (adds new note commitments, records nullifiers).
        *   Bundles this transaction with others into a block.
        *   Generates (or coordinates generation of) a final rollup proof for the entire block, attesting to the validity of all included state transitions (both private and public).
    *   *Status*: Transaction is included in an L2 block, ready for L1 settlement.

5.  **Settlement on L1 (Ethereum)**:
    *   The Sequencer (or a designated Prover) submits the rollup proof for the L2 block to the Verifier contract on Ethereum (L1).
    *   The L1 Verifier contract validates this rollup proof.
    *   If valid, the L1 Rollup contract records the new L2 state root (and other relevant data like L1-L2 message roots).
    *   *Status*: The L2 transaction is now final and settled on L1. Its effects are globally consistent.

## Transaction Requests (`TxRequest` in `aztec.js`)

This object, typically constructed by `aztec.js` or similar client libraries, encapsulates the user's intent for a transaction. Key fields often include:
*   `origin`: The [Account Contract](./../AccountsAndAuth/Accounts.md) address from which the transaction is initiated.
*   `functionData`: Contains details like the function selector and whether the function is private or public.
*   `argsHash`: A hash of all the arguments for the function calls to be executed. The full arguments are passed to the PXE and checked against this hash during simulation.
*   `txContext`: Contains chain ID, protocol version, and gas settings.
*   `salt`: A random value used, among other things, to make the first nullifier (if one is implicitly generated) difficult to predict.

An account contract validates that the transaction request has been authorized (e.g., via a signature check in its entrypoint function).

## Contract Interaction Methods (in `aztec.js`)

`aztec.js` provides methods on contract objects to build and send transactions:
*   `.create()`: Creates a `TxExecutionRequest` object, which is an authenticated request ready for simulation by the PXE.
*   `.simulate()`: Simulates the transaction locally (private execution, and optionally public as well if requested and feasible for simulation). Returns the function's return values. Does *not* generate a proof or send to the network.
*   `.prove()`: Simulates the transaction, then generates the ZK proofs for the private part of the execution. Returns a `ProvenTx` object containing these proofs and public inputs. Does *not* send to the network.
*   `.send()`: Simulates, proves, and then sends the `ProvenTx` to an Aztec Node to be broadcast and included in a block. Returns a `SentTx` object for tracking the transaction's status and receipt.

## Batch Transactions

Aztec.js supports batching multiple function calls originating from a single wallet/account into a single L2 transaction. This allows for more complex atomic operations.

## Fees

Transaction fees in Aztec are designed to cover:
*   **L1 Costs**: Ethereum execution of a block (verifying rollup proof) and data availability (e.g., via blobs for L2 block data).
*   **L2 Node Operating Costs**: Including the computational cost of proving by Sequencers/Provers.

**Key Terminology & Concepts**:
*   **`mana`**: Analogous to Ethereum's `gas`; a unit of computational effort.
*   **`fee-juice per mana`**: Analogous to `gas price`.
*   **`fee-juice`**: The actual amount paid for the transaction (the native fee asset of Aztec).
*   **Oracle for Pricing**: An oracle informs the `fee-juice per wei` price, allowing conversion to familiar L1 terms.
*   **EIP-1559 Influence**: Aztec may incorporate concepts like congestion multipliers and base/priority fees per mana.

**User Gas Settings (`GasSettings` in `aztec.js`)**: Users can specify limits for:
*   `gasLimits`: Data Availability (DA) and L2 execution gas limits.
*   `teardownGasLimits`: DA and L2 gas limits for an optional transaction teardown phase.
*   `maxFeesPerGas`: Maximum DA and L2 fees-per-gas the user is willing to pay.
*   `maxPriorityFeesPerGas`: Maximum priority DA and L2 fees-per-gas.

**Fee Payment Mechanisms**:
*   **Direct Payment**: Users can bridge the native `fee-juice` asset from L1. On L2, this asset is non-transferable by users and is only deducted by the protocol to pay for fees.
*   **Fee Paying Contracts (FPCs)**: Enable fee abstraction. These are smart contracts that can pay transaction fees on behalf of users. Users might interact with an FPC by paying it in a different token (e.g., a stablecoin), and the FPC then pays the `fee-juice` to the protocol. FPCs can have custom logic for authorizing fee payments (publicly or privately).

**Teardown Phase**: An optional phase in public execution where the transaction fee amount is available to public functions. This is useful for contracts that need to compute refunds or implement complex fee abstraction logic.

**Operator Rewards**: Collected `fee-juice` from transactions is pooled. After an epoch is proven, this pool (minus any burnt due to congestion) is distributed to Provers and Sequencers who contributed to that epoch.

(See also [Kernel Circuits](./KernelCircuits.md) for the role of kernel circuits in transaction validation.)

### Diagram: Simplified Transaction Flow
```mermaid
graph LR
    subgraph UserDevice [User's Device (PXE)]
        A[User Action in DApp/Wallet] --> B{Contract Interaction Call (.send())};
        B --Function Details, Args--> C[PXE Simulates & Proves Private Execution];
        C --Proven Private Part, Public Call Requests, Nullifiers, New Notes--> D[Tx Payload];
    end

    D --To Network--> E[Aztec Node];
    E --> F[Sequencer];

    subgraph SequencerProverNet [Sequencer/Prover Network]
        F --Validates Private Proofs--> G[Process Private State Updates];
        G --Public Call Requests--> H[Execute Public Functions & Generate Public Proofs (if any)];
        H --Proven Public Part--> I[Assemble L2 Block];
        I --Rollup Proof & Block Data--> J[L1 Rollup Contract on Ethereum];
    end
    
    J --Verify Proof & Update L2 State Root--> K[Transaction Settled on L1];
```

## Why it Matters for Developers
*   The client-side proving model is a fundamental shift from traditional blockchains.
*   Understanding the `aztec.js` contract interaction flow (`.create()`, `.simulate()`, `.prove()`, `.send()`) is essential for DApp development.
*   Fee mechanisms, especially Fee Paying Contracts (FPCs), offer significant flexibility for improving user experience regarding transaction costs. 