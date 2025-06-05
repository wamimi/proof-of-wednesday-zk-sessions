# Kernel Circuits: The Heart of Transaction Validation

Kernel circuits are fundamental to Aztec's transaction processing. They are responsible for validating the correct execution of function calls within a transaction and managing the transition between private and public execution phases. Aztec employs two main kernel circuits:

1.  **Private Kernel Circuit**
2.  **Public Kernel Circuit**

A transaction is constructed by generating proofs for potentially multiple recursive iterations of these kernel circuits. Each function call in a transaction's call stack corresponds to a new iteration of a kernel circuit. These calls are managed by FIFO (First-In, First-Out) queues: one for private calls and one for public calls.

One iteration of a kernel circuit will:
*   Pop a call request from its respective stack.
*   Execute the call (which for private calls means verifying its associated proof, and for public calls means actual execution or simulation leading to a proof).
*   If the executed call triggers subsequent contract calls (either private or public), these new calls are pushed onto the appropriate call stack.

## 1. Private Kernel Circuit

*   **Execution Environment**: This circuit is effectively executed by the **user, on their own device** (within their [PXE](./../ExecutionEnvironment/PXE.md)). This is paramount to ensure that all private inputs to the circuit (which includes sensitive user data and contract details) remain confidential.
*   **Zero-Knowledge Property**: The Private Kernel Circuit is one of the core protocol circuits that **must be truly "zk" (zero-knowledge)**. Its proofs must not leak any information about the witnesses (the private data being processed).
    *   This private data includes:
        *   Details of the Aztec.nr contract function being executed.
        *   The address of the user who executed the function.
        *   The intelligible (unencrypted) inputs and outputs of that function.
*   **Distinction from typical "zk-Rollups"**: Many rollups use SNARKs primarily for their succinctness (computation compression) and don't strictly require the zero-knowledge property because they don't handle private user data at this level. Aztec, by processing private data client-side within this circuit, genuinely leverages the "zero-knowledge" aspect of ZK-SNARKs. This is why it's sometimes referred to as a "zk-zk-Rollup" or an "actual zk-Rollup."
*   **Order of Operations**: Proofs involving the Private Kernel Circuit are generated first. A transaction is ready to move to the public execution phase only when the private call stack is empty.

## 2. Public Kernel Circuit

*   **Execution Environment**: This circuit is executed by a **Sequencer**. Only the Sequencer (or its delegated Provers) knows the current, up-to-date state of the public data tree at any given time, which is necessary for correct public function execution.
*   **Input**: The Public Kernel Circuit typically takes as input a proof from a Private Kernel Circuit (or another Public Kernel circuit iteration) where the private call stack is now empty.
*   **Operation**: It operates recursively, processing calls from the public call stack until it is also empty.
*   **Zero-Knowledge Not Strictly Required (for this circuit's inputs from public state)**: While it processes outputs from the private kernel (which are zk-proven), the public kernel itself, when dealing with public state and public function execution, doesn't inherently need to hide the public data it operates on from the Sequencer/Prover.

## Transaction Completion

A transaction is considered complete and its overall proof finalized when **both the private and public call stacks are empty**.

### Information Leakage

Even with this robust system, some information about the transaction is inevitably revealed (though significantly less than on a transparent L1):
*   The number of private state updates (new notes, nullifiers) triggered.
*   The set of public calls that were generated and executed.
*   The addresses of all *private* calls remain hidden from observers.

(See also [Transaction Lifecycle](./TransactionLifecycle.md) for how these circuits fit into the broader flow.) 