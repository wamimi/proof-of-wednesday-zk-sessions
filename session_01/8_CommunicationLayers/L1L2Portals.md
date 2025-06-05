# L1-L2 Communication (Portals)

Aztec, as a Layer 2 (L2) network, needs robust mechanisms to communicate with Layer 1 (L1), which is typically Ethereum. This communication is vital for bridging assets, relaying messages, and synchronizing state. Aztec achieves this through **Portals**.

**Analogy**: Think of Portals as secure, bi-directional communication channels or bridges connecting the Aztec L2 to the Ethereum L1.

## What are Portals?
*   Portals are special smart contracts that exist on both L1 and L2.
*   They facilitate the transfer of messages and assets between the two layers.
*   The L1 portal contract can call functions on the L2 portal contract, and vice-versa.

## Key Functions of Portals

### 1. Bridging Assets
*   **L1 to L2 (Deposits)**:
    1.  A user interacts with an L1 portal contract associated with a specific asset (e.g., an ERC20 token like DAI).
    2.  They typically lock their L1 assets in this L1 portal contract.
    3.  The L1 portal contract emits an L1 event (a message) that signals to the Aztec network that assets have been locked.
    4.  This message is picked up by Aztec Sequencers.
    5.  The Sequencer includes this message in an L2 block.
    6.  The corresponding L2 portal contract (or another designated L2 contract) receives this message and mints equivalent private L2 assets (e.g., PrivateDAI notes) to the user's Aztec account.
    *   **Security**: The L1 portal ensures assets are genuinely locked before signaling L2. The L2 side verifies the message originated from the legitimate L1 portal.
*   **L2 to L1 (Withdrawals)**:
    1.  A user initiates a withdrawal from their L2 private assets via an L2 contract (often interacting with an L2 portal).
    2.  The L2 assets are typically burned (or transferred to an L2 holding address).
    3.  The L2 contract (e.g., L2 portal) sends a message out to L1.
    4.  This message is included in an L2 block and eventually relayed to the L1 Rollup contract.
    5.  The L1 Rollup contract makes this message available/consumable on L1.
    6.  The user (or a relayer) can then present proof of this L2 message to the L1 portal contract.
    7.  The L1 portal contract verifies the message and releases the corresponding L1 assets to the user on L1.
    *   **Security**: The L2 side ensures assets are burned/secured before signaling L1. The L1 portal verifies the legitimacy of the withdrawal message from L2 (via Merkle proofs against the L2 state committed to L1).

### 2. Relaying Messages (Arbitrary Data)
*   Portals aren't just for assets. They can relay arbitrary messages between L1 and L2 contracts.
*   This allows for cross-chain governance, state synchronization, or triggering actions on one layer based on events on the other.
    *   **Example**: An L1 DAO could vote on a proposal, and the result (a message) could be sent through a portal to an L2 contract to execute a change based on that vote.

## Diagram: L1-L2 Asset Bridging via Portal

```mermaid
graph TD
    subgraph Ethereum_L1 [Ethereum (L1)]
        UserL1[User on L1]
        L1Portal[L1 Portal Contract (e.g., DAI Portal)]
        L1ERC20[L1 DAI Token Contract]
        L1Rollup[Aztec L1 Rollup Contract]
    end

    subgraph Aztec_L2 [Aztec (L2)]
        UserL2[User on L2]
        L2Portal[L2 Portal Contract (e.g., PrivateDAI Portal)]
        L2PrivateDAI[L2 PrivateDAI Contract/Notes]
        Sequencer[Aztec Sequencer]
    end

    %% L1 to L2 Deposit
    UserL1 -- 1. Approves & Calls deposit() --> L1Portal;
    L1Portal -- 2. Locks L1 DAI (transfers from UserL1) --> L1ERC20;
    L1Portal -- 3. Emits L1->L2 Message (DepositInfo) --> L1Rollup;
    L1Rollup -- 4. Message included in L2 batch --> Sequencer;
    Sequencer -- 5. Relays message to L2 --> L2Portal;
    L2Portal -- 6. Mints PrivateL2DAI to UserL2 --> L2PrivateDAI;
    UserL2 -- Receives L2 Assets --> L2PrivateDAI;

    %% L2 to L1 Withdrawal (Simplified)
    UserL2 -- "A. Initiates withdrawal (burns L2 assets)" --> L2Portal;
    L2Portal -- "B. Sends L2->L1 Message (WithdrawalInfo)" --> Sequencer;
    Sequencer -- "C. Message included in L2 block, root published" --> L1Rollup;
    UserL1 -- "D. Proves L2 message to L1Portal (via L1Rollup state)" --> L1Portal;
    L1Portal -- "E. Releases L1 DAI to UserL1" --> L1ERC20;
```

## Technical Details

*   **Message Trees**: Messages between L1 and L2 are often organized into Merkle trees (e.g., an L1->L2 message tree and an L2->L1 message tree). The roots of these trees are periodically committed to the other layer.
    *   This allows for efficient proof that a specific message was indeed sent and is part of the agreed-upon communication batch.
*   **`outbox` and `inbox`**: The L1 Rollup contract usually maintains an `outbox` (for L2->L1 messages) and an `inbox` (for L1->L2 messages) represented by these Merkle roots.
*   **Consumption**: A message can typically only be consumed once to prevent replay attacks.

## Security Considerations

*   **Portal Contract Security**: The Portal contracts themselves must be secure, as they control the locking/unlocking of assets and the validation of messages.
*   **Message Integrity and Authenticity**: Ensuring that messages haven't been tampered with and originate from the correct source portal is critical.
*   **Relayer Incentives (for L2->L1 messages)**: While users can often consume their own L2->L1 messages on L1, sometimes relayers are used. The system needs to ensure relayers are properly incentivized and act honestly.

## Why it Matters for Developers
*   Portals are the primary mechanism for bringing liquidity and data into and out of the Aztec L2.
*   If your DApp needs to interact with L1 assets or L1 contracts, you will likely be interacting with or building on top of Portal contracts.
*   Understanding the asynchronous nature and the message-passing mechanics of portals is key to designing robust cross-layer applications.

(See also [Private/Public Calls within L2](./PrivatePublicCalls.md) for communication purely within Aztec.) 