# Key Concept: Account Abstraction (Aztec vs. EVM)

"Account Abstraction" (AA) is a term that means "making accounts more flexible and programmable." Both Ethereum and Aztec have a form of AA, but they are architecturally very different. Understanding this difference is key to grasping the power of Aztec.

## The EVM Model: EOAs + Smart Contract Wallets

In the Ethereum Virtual Machine (EVM), there are two distinct types of "accounts":

1.  **Externally Owned Accounts (EOAs):**
    -   This is your standard wallet (like MetaMask).
    -   It's a simple public/private key pair.
    -   It is controlled *externally* by a person holding the private key.
    -   **Limitation:** The logic is fixed. It can only sign and send transactions. It cannot have custom logic like spending limits, multi-signature requirements, or social recovery baked into it.

2.  **Smart Contract Accounts (or "Smart Wallets"):**
    -   These are smart contracts that are designed to hold assets and execute actions on behalf of a user (e.g., Gnosis Safe, Argent).
    -   They can have any logic you can code in Solidity: multi-sig, daily limits, white-listed addresses, etc.
    -   **Limitation:** It's not a "native" account. To use it, an EOA must pay gas and send a transaction *to* the smart contract wallet, which then executes the desired action. This often results in a clunky, two-step user experience and higher gas costs.

**Analogy: A Person with a Bank Account**
- An **EOA** is like you, a person. You can sign checks with your signature, but that's it.
- A **Smart Contract Wallet** is like a trust or a company you set up. You (the person) have to give instructions to the trust (the contract), and the trust then acts on your behalf according to its own complex rules.

ERC-4337 is a major effort to reduce this friction on Ethereum, but it still works within this fundamental EOA/Contract Account separation.

## The Aztec Model: Native Account Abstraction

In Aztec, this separation does not exist.

**Every single account on the Aztec network *is* a smart contract.**

There are no EOAs in the EVM sense. When you create a "wallet" in Aztec, you are deploying a smart contract that will represent your identity and hold your assets.

This means:

-   **Programmable Validity:** The logic for what makes a transaction valid is defined directly in the account contract itself. The default account uses a standard signature scheme, but as we saw in our tutorial, you can easily replace it with Schnorr signatures, multi-sig logic, or anything else you can write in Noir.
-   **The `entrypoint` Function:** This function is the heart of Aztec AA. It is a mandatory function in every account contract that acts as the single gatekeeper for all transactions originating from that account. Before any transaction proceeds, it must first pass the logic defined in its account's `entrypoint`.
-   **Unified & Seamless UX:** There is no two-step process. When a user interacts with a dApp, their `wallet` object (which represents their account contract) seamlessly handles the custom authentication flow in the background. To the user and the dApp, it feels like a single, direct interaction.

**Analogy: A Programmable Robot**
- An **Aztec Account** is like a programmable robot that holds your assets. You define its operating system.
- By default, it might only respond to your password (`DefaultAccount`).
- But you can reprogram it to require two passwords, or a password and a fingerprint, or only operate between 9 AM and 5 PM.
- When you want to do something, you give a command to the robot. The robot checks its internal rules (`entrypoint` function) to see if your command is valid before executing it.

This native implementation of Account Abstraction is a fundamental advantage of Aztec, providing developers with unparalleled flexibility and security while creating a simpler and more powerful experience for users. 