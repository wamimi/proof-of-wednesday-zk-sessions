# Accounts: Smart Accounts for Everyone

**Core Idea**: Aztec has **native Account Abstraction (AA)**. This means *every* account on Aztec is a smart contract, not just a private key. There are no Externally Owned Accounts (EOAs) like in Ethereum.

## What is Account Abstraction?
AA allows a user's on-chain identity to be represented by a smart contract with custom logic, rather than being rigidly tied to a private/public key pair. This enables features like:
*   Account recovery (social recovery, etc.).
*   Gas sponsorship (dapps paying fees for users).
*   Support for various authentication methods (e.g., Schnorr signatures, BLS signatures, WebAuthn/passkeys, multi-factor authentication).
*   Custom transaction validation logic.

## Aztec's Native AA Advantages
*   **No Limits on Verification Logic Complexity (for on-chain cost)**: Because the most complex parts of account verification (like signature checks or multi-sig logic) happen in private functions and are proven client-side, their complexity doesn't directly translate to higher gas fees on L2. The sequencer only verifies a lightweight proof.
    *   **Example**: A multisig contract needing 10 out of 20 signatures, or an oracle contract verifying data from many providers, can have this complex logic proven efficiently by the user's [PXE](./../ExecutionEnvironment/PXE.md).
*   **Flexibility**: Developers can define how an account authenticates, authorizes actions, handles replay protection (nonces), and pays fees.

## Aztec Account Details
*   **Address**: An Aztec address is derived deterministically from the account contract's bytecode and its associated public keys (for encryption, nullification). See [Keys](./../Keys/Keys.md) for more on address derivation.
*   **Entrypoints**: Account contracts typically have a specific function (often called `entryPoint`) that serves as the main interface for initiating transactions. This function receives actions to perform and an authentication payload (e.g., a signature).
    *   A typical `entryPoint(payload)` might:
        1.  Validate the authentication payload (e.g., checks a signature against a stored public key).
        2.  Iterate through requested private calls and executes them.
        3.  Iterate through requested public calls and enqueues them.
*   **Non-Standard Entrypoints**: Since the entrypoint interface isn't strictly enforced by the protocol, contracts can have functions that don't require user authentication and can be called by anyone (e.g., a `claimPrize` function in a lottery). The `msg_sender` will be set accordingly (e.g., to `Field.max` if no contract entrypoint is used, or to the contract making a private-to-public call).
*   **Coupling with Wallets**: Account contracts are tightly linked to wallet software. The wallet knows how to encode and sign requests for the specific account contract implementation the user has chosen. See [Wallets](./../ExecutionEnvironment/Wallets.md).

## Account Initialization and Deployment
*   To interact with public state or send transactions *from* an account, its contract must be **deployed**. This involves broadcasting it via the canonical `ContractInstanceDeployer` contract, which also emits a deployment nullifier.
*   An account contract is **initialized** when one of its functions marked with `#[initializer]` is called. Multiple functions can be initializers. Functions marked `#[noinitcheck]` can bypass this.
*   **Crucially**: Users can *receive* private [Notes](./../NotesAndUTXOs/Notes.md) (funds) even before their account contract is deployed or initialized because their address is deterministic.
*   Deployment costs fees, which can be pre-funded to the deterministic address or paid by another account via fee abstraction (see [Transaction Lifecycle](./../TransactionsAndKernels/TransactionLifecycle.md) for fees).

## Complete Address vs. Public Address
*   **Public Address**: The `x`-coordinate of the `AddressPublicKey` (a Grumpkin elliptic curve point). This is what you share to receive funds.
*   **Complete Address**: Includes all the user's relevant public keys, a "partial address" (related to contract class and initialization), and the contract address. Needed by the user to *spend* their notes (as it proves ownership of keys).

## Authorizing Actions
Account contracts are expected (though not protocol-required) to implement methods for authorizing actions on behalf of the user (e.g., allowing another contract to transfer tokens).
*   **Private Context**: Account contracts can request an **authentication witness (AuthWit)** (e.g., a signature for an action) from the user's [PXE](./../ExecutionEnvironment/PXE.md) via an oracle call. See [Authentication Witness (Authwit)](./AuthWit.md).
*   **Public Context**: Since the PXE oracle isn't accessible during public execution, account contracts can maintain a public **authwit registry** (in their public storage) for pre-authorized actions.
*   This allows an account contract to verify `is_valid_impl` (is this action authorized?) in both private and public settings.
*   *Note on transaction simulations in PXE*: Currently, simulations might not fully anticipate authwit needs, requiring manual provision. This is expected to improve.

## Nonce Abstraction
*   Developers can customize how nonces (for replay protection) are managed. This allows for flexible transaction ordering, cancellation logic (e.g., by emitting a specific nullifier to cancel a pending tx), etc.
*   This is particularly relevant for wallet developers, enabling varied transaction priority/cost strategies.

## Fee Abstraction (Paymasters)
*   **Paymaster Contracts**: Smart contracts that can pay transaction fees on behalf of users.
*   Invoked during private execution and set as the fee payer.
*   Can accept fees in any token they're programmed for (e.g., users pay with a stablecoin, paymaster converts and pays fee-juice).
*   Enables sponsored transactions, private fee payments, etc.
*   Learn more about fees on the [Transaction Lifecycle](./../TransactionsAndKernels/TransactionLifecycle.md) page.

## Why it Matters for Developers
*   AA is a powerful paradigm. You can build novel authentication and authorization flows directly into user accounts.
*   Understanding the `entryPoint` pattern is key for interacting with accounts.
*   Fee abstraction and nonce abstraction offer significant UX improvements for dapps. 