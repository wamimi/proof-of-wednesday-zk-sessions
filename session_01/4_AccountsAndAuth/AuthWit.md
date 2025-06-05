# Authentication Witness (Authwit)

Authentication Witness (Authwit) is a scheme in Aztec for authenticating actions, allowing users to authorize third parties (like protocols or other users) to execute specific actions on their behalf. This is crucial for enabling complex interactions, especially in DeFi, while maintaining user control and security.

## Background: The Challenge of Approvals

In Ethereum's EVM world, contract interactions often involve an `approve` and `transferFrom` pattern for ERC20 tokens. A user first sends an `approve` transaction to the token contract, granting an allowance to another contract (e.g., a DeFi protocol). Then, they call a function on the DeFi protocol, which in turn calls `transferFrom` on the token contract using that allowance.

**Downsides of Traditional EVM Approvals:**
*   **Two Transactions**: Requires two separate transactions (approve, then the action), which is poor UX.
*   **Infinite Allowances**: Front-ends often request infinite allowances to avoid repeated approvals, which poses a security risk. If the approved contract is exploited or malicious (especially if upgradeable), it can drain all approved funds without further user interaction.
*   **Permit (EIP-2612)**: Improves this by allowing off-chain signing of an approval (permit), which is then submitted with the main action in a single transaction. However, this doesn't work well with smart contract wallets (without EIP-1271 adoption) and the signed messages can be opaque to users.

## Authwit in Aztec: A New Approach

Aztec's private state model presents unique challenges for the traditional approval/allowance mechanism. If a protocol has an "allowance" to spend a user's private notes, it doesn't help unless the protocol also knows the details (decryption keys, content) of those private notes, which it shouldn't.

However, Aztec's architecture offers a solution:
*   **Private Execution on User Device**: Transactions involving private state are executed (and proven) on the user's device via their [PXE](./../ExecutionEnvironment/PXE.md).
*   **Oracle Calls**: During this private execution, the contract can request additional user-provided information via oracle calls.

**Authwit leverages this**: Instead of an allowance, the user provides a "witness" (which could be a signature, but isn't limited to it) to the contract, authorizing a specific action.

### What is an "Action" in Authwit?

An "action" is a blob of data that precisely specifies:
*   The **caller** authorized to initiate the action.
*   The target **contract** to be called.
*   The **selector** of the function to be called on the target contract.
*   A **hash of the arguments** (`argsHash`) for that function call.

This is typically represented as a hash:
`authentication_witness_action = H(caller: AztecAddress, contract: AztecAddress, selector: Field, argsHash: Field)`

**Example**: Alice wants to deposit 1000 tokens into a DeFi contract. The DeFi contract needs to transfer tokens from Alice's account.
*   The `caller` would be the DeFi contract's address.
*   The `contract` would be the Token contract's address.
*   The `selector` would be the `transfer_selector`.
*   The `argsHash` would be `H(alice_account_address, defi_contract_address, 1000)`. // (Or H(alice_account_address, defi_contract_address, 1000, nonce) for replay protection)

The Authwit effectively says: "DeFi_contract is allowed to call Token_contract.transfer(alice_account, defi_contract, 1000).

### Authwit Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant PXEWallet as User's PXE/Wallet
    participant DAppContract as DApp Contract (e.g., DeFi)
    participant TokenContract as Token Contract
    participant AccountContract as User's Account Contract

    User->>PXEWallet: Initiate action (e.g., DApp.deposit(1000))
    PXEWallet->>DAppContract: Prepare DApp.deposit() call
    Note over PXEWallet,DAppContract: DApp needs to call Token.transferFrom(User, DApp, 1000)
    
    PXEWallet->>AccountContract: (Via Oracle during simulation) Request AuthWit for DApp to call Token.transferFrom(User, DApp, 1000)
    AccountContract->>PXEWallet: User approves; PXE generates AuthWit (e.g., signature over action hash)
    
    PXEWallet->>DAppContract: Execute DApp.deposit(1000, generatedAuthWit)
    DAppContract->>TokenContract: Call Token.transferFrom(User, DApp, 1000, generatedAuthWit)
    
    TokenContract->>AccountContract: STATICCALL Account.isValidAuth(actionHash, generatedAuthWit)
    AccountContract->>AccountContract: Validate witness against actionHash (e.g., verify signature)
    AccountContract-->>TokenContract: Return true / false
    
    alt AuthWit Valid
        TokenContract->>TokenContract: Perform transfer logic (nullify old notes, create new notes)
        TokenContract-->>DAppContract: transferFrom successful
        DAppContract->>DAppContract: Complete deposit logic
        DAppContract-->>PXEWallet: deposit successful
    else AuthWit Invalid or other error
        TokenContract-->>DAppContract: transferFrom failed
        DAppContract-->>PXEWallet: deposit failed
    end
```

**Important Considerations**: 
*   The call from the TokenContract to the AccountContract to check `isValidAuth` **must be a static call**. This prevents re-entrancy issues where the account contract might try to change state or call back into the token contract unexpectedly during the authorization check.
*   The witness itself is provided by the PXE through an oracle call during the private execution of the contract that needs to be authenticated (e.g., the TokenContract in the diagram above, if `transferFrom` is private).

### Authwit for Public State Interactions

While oracle calls are for private execution, Authwit can be extended to public state:
*   Instead of relying on a private oracle call, the Authwit (or a commitment to it) can be stored in a **public shared registry** (e.g., in the AccountContract's public storage).
*   A public function can then look up this pre-approved Authwit.
*   This can be done in the same transaction: batch the Authwit update (storing it) with the interaction that consumes it. If set and unset in the same transaction, there might be no net public state change for the authorization itself, potentially saving gas.

### Replay Protection

To ensure an Authwit can only be used once (or a controlled number of times):
*   The `authentication_witness_action` itself (or its hash) can be **emitted as a nullifier** by the contract that consumes the authorization (e.g., the TokenContract).
*   This prevents the same exact action from being authenticated twice.
*   If an action needs to be authorized multiple times, a **nonce** should be included in the arguments when hashing to create the `argsHash`. This makes each `authentication_witness_action` unique.
    *   Example: `argsHash = H(alice_account, defi_contract, 1000, nonce)`
*   The AccountContract (which is static_called for `isValidAuth`) cannot emit the nullifier. The calling contract (e.g., TokenContract) is responsible for this, similar to how nonces are handled in some ERC20 permit implementations. Aztec may provide libraries to help manage this.

### Differences from EVM Approvals

*   **Specificity**: Authwit authorizes a *specific action*, not a general allowance. This is more explicit and gives the user clearer insight into what they are approving.
*   **User-Centric Execution**: For private interactions, the user is already executing the transaction on their device, making the provision of secrets or detailed note information less of a barrier compared to a protocol trying to act on a user's behalf with only an allowance.

**Limitation Note**: Authwits are primarily for a single user authorizing actions on contracts that their account is interacting with. They are not typically used to authorize *other users* to take actions on one's behalf in a way that would require sharing fundamental account secrets like the nullifier secret key.

### Broader Use-Cases

Authwit isn't limited to token transfers. It can be used for any function requiring user authentication, such as:
*   Authorizing a burn operation.
*   Approving the movement of assets from public to private state.
*   Voting in a governance contract.
*   Performing operations on a lending protocol on behalf of the user.

## Next Steps

Refer to the official Aztec developer documentation to see how to implement and use Authwit patterns in your Aztec.nr smart contracts. 