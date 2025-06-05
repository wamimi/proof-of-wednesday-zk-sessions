# Call Types: How Contracts Talk to Each Other

Aztec contracts can call functions on other contracts, and these interactions can cross privacy boundaries (private to public, public to private). Understanding the different call types is crucial for designing secure and efficient applications.

## Context: Private and Public Execution

*   **Private Functions**: Executed and proven client-side (in the user's [PXE](./../ExecutionEnvironment/PXE.md)). They operate on private state and can call other private functions or enqueue calls to public functions.
*   **Public Functions**: Executed and proven by the network Sequencer. They operate on public state and can call other public functions or enqueue calls to private functions.

## Types of Contract Calls

### 1. Private-to-Private Calls
*   **How it works**: A private function in Contract A calls a private function in Contract B.
*   **Execution**: Both functions are executed and proven client-side within the same transaction's private phase.
*   **Data Flow**: Private data can be passed between these functions directly within the client-side execution environment.
*   **Atomicity**: If one call fails, the entire private portion of the transaction typically fails.

### 2. Private-to-Public Calls
*   **How it works**: A private function in Contract A calls (enqueues a request for) a public function in Contract B.
*   **Execution**: The private function (A) is proven client-side. The public function (B) is executed by the Sequencer later, when the transaction is processed.
*   **Data Flow**: Data from the private function to the public function must be passed as public inputs/arguments. The private function cannot directly see the return value of the public function within the same transaction because of the asynchronous execution.
    *   **Analogy**: Sending a letter (private call with its data) to a public office (public function). The office processes it later. You don't get an immediate response in your private context.
*   **Security**: The private function proves it has correctly formed the request for the public call.

### 3. Public-to-Public Calls
*   **How it works**: A public function in Contract A calls a public function in Contract B.
*   **Execution**: Both functions are executed by the Sequencer during the public phase of transaction processing.
*   **Data Flow**: Data can be passed directly, and return values are immediately available.
*   **Atomicity**: If one call fails, the relevant public portion of the transaction typically fails.

### 4. Public-to-Private Calls
*   **How it works**: A public function in Contract A calls (enqueues a request for) a private function in Contract B.
*   **Execution**: The public function (A) is executed by the Sequencer. The request for the private function (B) is then picked up by the recipient's PXE in a subsequent block/process.
*   **Data Flow**: Data from the public function to the private function must be passed in a way that the recipient's PXE can identify and use to initiate the private execution (e.g., as parameters in an encrypted log or event that the PXE is scanning for).
    *   **Analogy**: A public office (public function) posts a sealed, addressed task (request for private call) on a public board. Only the intended recipient (user's PXE) can open and act on it later.
*   **Asynchronous & User-Initiated**: This is highly asynchronous. The private call won't happen until the user's PXE detects the request and initiates a new transaction to execute that private function.
*   **Return Values**: The public function cannot directly receive a return value from the private function in the same transaction.

## Diagram: Call Type Interactions

```mermaid
graph TD
    subgraph ClientDevice [User's Device (PXE)]
        P1["Private Fn (Contract A)"]
        P2["Private Fn (Contract B)"]
    end

    subgraph SequencerNetwork [Sequencer/Network]
        U1["Public Fn (Contract C)"]
        U2["Public Fn (Contract D)"]
    end

    P1 -- "1. Private-to-Private" --> P2;
    P1 -- "2. Private-to-Public (Enqueue)" --> U1;
    U1 -- "3. Public-to-Public" --> U2;
    U1 -- "4. Public-to-Private (Enqueue/Event)" --> P1_Future["Future Private Fn (Contract A) - User Initiated"];
    
    style P1_Future fill:#eee,stroke:#333,stroke-width:2px,color:#333,stroke-dasharray: 5 5;
    P1_Future -.-> ClientDevice;
```
*(Note: The diagram simplifies by showing Contract A's private function being called back; it could be any private function on any contract intended for that user.)*

## Key Considerations for Developers

*   **Asynchronicity**: Calls between private and public contexts are generally asynchronous. Design your application logic to handle this, often using a multi-transaction workflow for request/response patterns across privacy domains.
*   **Data Passing**: Carefully consider how data is passed, especially for private-to-public (data becomes public) and public-to-private (data needs to be securely and discoverably passed to the recipient for their PXE to act on).
*   **State Consistency**: The public state is updated by the Sequencer. Private state is managed client-side and its commitments/nullifiers are submitted. Understand how these interact, especially when a private function relies on some public state or vice-versa.
*   **Gas and Proving Costs**: Different call types and the complexity of the functions involved will have different implications for proving time (client-side for private, sequencer-side for public) and transaction fees.

(See also [Kernel Circuits](./../TransactionsAndKernels/KernelCircuits.md) for how calls are managed internally.) 