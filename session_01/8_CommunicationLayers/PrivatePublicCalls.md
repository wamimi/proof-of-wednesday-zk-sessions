# Private/Public Calls within L2

While [L1-L2 Portals](./L1L2Portals.md) manage communication between Ethereum and Aztec, equally important is how different execution contexts *within* Aztec L2 interact. Aztec's hybrid state model means contracts have both private and public functions, and they often need to call each other.

**Recap of Execution Contexts:**
*   **Private Execution**: Happens on the user's device within their [Private Execution Environment (PXE)](./../ExecutionEnvironment/PXE.md). Involves user's private data, private state, and client-side ZK proof generation.
*   **Public Execution**: Happens on the Sequencer's infrastructure. Involves public state and is verified by the network.

## Communication Pathways (Call Types Revisited)

The primary ways these contexts interact are through specific [Call Types](./../ContractCalls/CallTypes.md):

### 1. Private-to-Private Calls
*   **Context**: Entirely within the user's PXE (client-side).
*   **Mechanism**: A private function in Contract A directly calls a private function in Contract B.
*   **Data Flow**: Synchronous. Arguments and return values are passed directly within the private execution simulation. All data remains private to the user.
*   **Atomicity**: Forms a single atomic unit within the private phase of the transaction.
*   **Example**: A private DeFi aggregator calls a private function on a private AMM contract to get a quote, all within the user's simulation before any proof is generated for the sequence.

### 2. Private-to-Public Calls
*   **Context**: Initiated client-side (PXE), completed by the Sequencer.
*   **Mechanism**: A private function in Contract A *enqueues a request* for a public function in Contract B to be executed.
*   **Data Flow**: Asynchronous.
    *   The private function provides arguments for the public call. These arguments become public data.
    *   The private function *cannot* directly receive a return value from the public function in the same transaction because the public function executes later on the Sequencer.
    *   If a result from the public call is needed back in a private context, it typically involves a subsequent transaction or a mechanism where the public function emits an event/log that the user's PXE can later pick up and use to initiate a new private transaction.
*   **Kernel Interaction**: The [Private Kernel Circuit](./../TransactionsAndKernels/KernelCircuits.md) processes the private call and adds the public call request to a public call stack. The [Public Kernel Circuit](./../TransactionsAndKernels/KernelCircuits.md) later processes this stack.
*   **Example**: A user privately votes on a proposal (private function). This private function then makes a public call to a governance contract to increment a public vote counter for that proposal.

### 3. Public-to-Public Calls
*   **Context**: Entirely within the Sequencer's execution environment.
*   **Mechanism**: A public function in Contract A directly calls a public function in Contract B.
*   **Data Flow**: Synchronous. Arguments and return values are passed directly. All data is public.
*   **Atomicity**: Forms a single atomic unit within the public phase of the transaction.
*   **Example**: A public governance contract, after tallying votes, calls a public function on a treasury contract to release funds.

### 4. Public-to-Private Calls
*   **Context**: Initiated by the Sequencer, completed client-side (PXE) in a *future* transaction.
*   **Mechanism**: A public function in Contract A *emits data or an event* (e.g., an encrypted log with a specific tag) that signals a request for a private function in Contract B (belonging to a specific user) to be executed.
*   **Data Flow**: Highly asynchronous and indirect.
    *   The public function outputs data intended for the private call (e.g., parameters, a callback identifier).
    *   This data must be findable and interpretable by the target user's PXE (e.g., through [Note Discovery](./../NotesAndUTXOs/NoteDiscovery.md) mechanisms if it involves creating a note for the user, or by scanning for specific events).
    *   The target user's PXE, upon discovering this request, must then construct and initiate a *new transaction* to execute the requested private function.
    *   The public function that initiated the request cannot get a direct return value from this subsequent private execution.
*   **Analogy**: A public announcement system (public function) leaves a coded, sealed message on a public bulletin board for a specific individual. That individual (user's PXE) must find the message, decode it, and then decide to act on it privately later.
*   **Example**: An L2 airdrop contract (public function) wants to distribute private tokens to eligible users. It might emit encrypted logs, each containing the airdrop details for a specific user. The user's PXE detects the log addressed to them and then initiates a private transaction to claim these tokens into their private balance.

## Diagram: Intra-L2 Communication Flow

```mermaid
graph TD
    subgraph UserPXE [User's PXE - Client-Side]
        direction LR
        PrivA1["Private Fn (Contract A)"] -- Private-to-Private --> PrivB1["Private Fn (Contract B)"]
        PrivA1 -- Private-to-Public (Enqueue) --> PubKernelIn[Public Call Request]
    end

    subgraph Sequencer [Sequencer - Network-Side]
        direction LR
        PubKernelOut[Public Call Request] --> PubC1["Public Fn (Contract C)"]
        PubC1 -- Public-to-Public --> PubD1["Public Fn (Contract D)"]
        PubC1 -- Public-to-Private (Emit Event/Log) --> EventForUser[Event/Encrypted Log for UserX]
    end
    
    PubKernelIn --> PubKernelOut

    subgraph UserPXE_Future [UserX's PXE - Future Transaction]
        direction LR
        EventForUserDiscovered[PXE Discovers Event/Log] --> PrivA2_Claim["Private Fn (e.g., Claim in Contract A)"]
    end

    EventForUser -.-> EventForUserDiscovered

    note right of UserPXE : Initial Transaction: Private Phase
    note right of Sequencer : Initial Transaction: Public Phase (later)
    note right of UserPXE_Future : Subsequent Transaction by UserX
```

## Key Design Patterns & Considerations

*   **State Oracle / View Functions**: Often, a private function might need to read public state. This is typically done by the PXE querying an Aztec Node for the relevant public state *before* the private simulation begins, and then feeding this public state as an input to the private circuit. The private circuit then asserts that the provided public state matches a known public state root.
*   **Callback Mechanisms**: For scenarios requiring a "response" from a public action back to a private context (or vice-versa), developers usually need to implement a multi-step, multi-transaction process:
    1.  Tx1: Private function makes a request to a public function and potentially stores a unique ID.
    2.  Tx1 (Public Phase): Public function executes, does its work, and emits an event including the unique ID and the result.
    3.  Tx2 (Later): User's PXE detects the event, matches the ID, and initiates a new private transaction that consumes the result.
*   **Synchronicity Assumptions**: Never assume synchronous data return when crossing the private/public boundary within the same transaction. Design for eventual consistency and message passing.
*   **Gas & Proving Implications**: Private-to-public calls involve client-side proving for the private part and sequencer-side execution for the public part. Public-to-private calls are more complex, involving sequencer execution, event emission, client-side discovery, and then a full new client-side transaction.

Understanding these internal L2 communication flows is essential for building complex, hybrid private/public applications on Aztec. 