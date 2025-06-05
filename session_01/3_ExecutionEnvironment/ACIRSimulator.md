# ACIR Simulator

The ACIR (Abstract Circuit Intermediate Representation) Simulator is a key component responsible for the simulation of Aztec smart contract function executions. Its primary purpose is to aid in the correct execution of Aztec transactions by pre-determining their outcomes and collecting necessary data.

## Core Functionality

Simulating a function with the ACIR Simulator involves:

*   **Generating a Partial Witness**: This is the set of specific inputs (including private ones) that satisfy the function's logic (the circuit).
*   **Generating Public Inputs**: These are the inputs to the circuit that will be publicly visible.
*   **Collecting Data**: Gathering all essential data outputs and side effects from the simulated execution. This includes:
    *   New notes created.
    *   Nullifiers for spent notes.
    *   Public state changes.
    *   Any other data necessary for components further down the transaction processing pipeline (e.g., for proof generation or kernel circuit inputs).

## Simulating Different Function Types

The ACIR Simulator can handle all three types of Aztec contract functions:

### 1. Private Functions (`#[private]`)
*   **Execution Environment**: Simulated and subsequently proven client-side (e.g., within the user's [PXE](./PXE.md)).
*   **Verification**: The generated proof is verified client-side by the private kernel circuit.
*   **Oracle Assistance**: Private function simulations are run with the assistance of a **DB oracle**. This oracle is an interface (typically implemented by the PXE) that provides any private data requested by the function during its execution (e.g., specific notes to spend, user keys, authwits).
    *   *Further reading on oracle functions can be found in the smart contract section of the official Aztec documentation.*
*   **Composability**:
    *   Private functions can call other private functions (synchronously within the simulation).
    *   Private functions can *request* to call a public function. This public function execution will be performed asynchronously by the sequencer in the actual transaction. Therefore, private functions do not have direct access to the return values of public functions they enqueue within the same transaction.

### 2. Public Functions (`#[public]`)
*   **Execution Environment**: Simulated and proven on the sequencer side.
*   **Verification**: Verified by the public kernel circuit (also on the sequencer side).
*   **Oracle Assistance**: Public function simulations are run with the assistance of an oracle that provides any values read from the public state tree.
*   **Composability**:
    *   Public functions can call other public functions. This composability can happen atomically within the public execution phase.
    *   Public functions *can* call private functions, but this also happens asynchronously. The private function call must be processed in a future block, as it requires client-side proving.

### 3. Utility Functions (`#[utility]`)
*   **Purpose**: Used to extract useful data for users or client applications, such as querying a user's private balance. They are not part of an on-chain transaction's execution flow.
*   **Execution Environment**: Simulated client-side (e.g., within the PXE).
*   **No Proofs**: Utility functions are **not proven**.
*   **Oracle Assistance**: They are run with the assistance of an **oracle resolver** (typically part of the PXE) that provides any private or public data requested by the function.
*   **Composability (Current Limitations)**:
    *   At present, utility functions generally cannot call other functions (private, public, or other utility functions).
    *   Allowing utility functions to call other utility functions is on the Aztec roadmap. 