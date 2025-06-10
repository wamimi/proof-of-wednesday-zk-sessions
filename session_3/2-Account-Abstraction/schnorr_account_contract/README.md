# 2a. Account Abstraction: The Noir Contract

This tutorial covers the first part of our Account Abstraction deep dive: writing the custom account contract in Noir.

**Goal:** Build a custom account contract that uses a hardcoded Schnorr signature for transaction authentication.

## Background: What is Account Abstraction in Aztec?

In Aztec, every account *is* a smart contract. This is different from Ethereum's EOA model. It means you can define custom logic for how your account authorizes transactions. Instead of being limited to a single private key signature (like an EOA), you can implement multi-sig, social recovery, or, as we'll do here, use a different signature scheme like Schnorr.

## Step 1: Create a New Contract Project

If you haven't already, create a new directory for this project.

```bash
# In your session_3/2-Account-Abstraction/ directory
aztec-nargo new --contract schnorr_account_contract
```

This creates the `schnorr_account_contract` directory with the standard `src` and `Nargo.toml` files.

## Step 2: Add Dependencies

Open `schnorr_account_contract/Nargo.toml` and add the `aztec` and `authwit` libraries as dependencies. The `authwit` library is crucial as it provides the necessary tools and interfaces for building custom account authentication logic.

**`Nargo.toml`**
```toml
[package]
name = "schnorr_hardcoded_account"
authors = [""]
compiler_version = ">=0.23.0"
type = "contract"

[dependencies]
aztec = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/aztec" }
authwit = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/authwit"}
```

## Step 3: Write the Account Contract

Open `schnorr_account_contract/src/main.nr` and replace its contents with the code below. This contract defines the rules for our custom account.

**`src/main.nr`**
```rust
// Account contract that uses Schnorr signatures for authentication using a hardcoded public key.
use dep::aztec::macros::aztec;

#[aztec]
pub contract SchnorrHardcodedAccount {
    use dep::authwit::{
        account::AccountActions,
        auth_witness::get_auth_witness,
        entrypoint::{app::AppPayload, fee::FeePayload},
    };
    use dep::aztec::prelude::PrivateContext;
    use dep::aztec::macros::functions::{private, view};
    use std::embedded_curve_ops::EmbeddedCurvePoint;

    // Hardcoded public key for Schnorr verification
    global public_key: EmbeddedCurvePoint = EmbeddedCurvePoint {
        x: 0x16b93f4afa5e5338cb8a65529f5723b71f92b3a99cb9c0f9942352885a49852f,
        y: 0x011d68a0f5a720973e6cefe68e3d2e81134b22c34795b5c1f6a1e367683451e,
    };

    // The main entrypoint for all transactions for this account
    #[private]
    fn entrypoint(payload: AppPayload, fee_payload: FeePayload) -> pub AccountActions {
        let is_valid = is_valid_impl(payload);
        assert(is_valid);
        payload.actions.execute(&mut context)
    }

    // A view function to check validity without sending a transaction
    #[view]
    fn is_valid(payload: AppPayload) -> bool {
        is_valid_impl(payload)
    }

    // The core validation logic
    fn is_valid_impl(payload: AppPayload) -> bool {
        // 1. Request the signature (auth witness) from the user's wallet (PXE)
        let signature: [Field; 64] = get_auth_witness(&mut context, payload.hash());
        
        // 2. Verify the signature against the hardcoded public key
        let verification = std::schnorr::verify_signature(public_key, signature, payload.hash());
        
        verification
    }
}
```

## Step 4: Compile the Contract

Navigate to your `schnorr_account_contract` directory and run the compile command:

```bash
aztec-nargo compile
```

If successful, this verifies your code is correct and creates the compiled artifact in the `target/` directory.

## Summary

You have now created the core Noir logic for a custom Aztec account. The key takeaways are:
-   Every Aztec account is a contract, giving you full control over its logic.
-   The `entrypoint` function is the gatekeeper for all transactions.
-   The `authwit` library and `get_auth_witness` oracle call are how your contract securely requests authentication data (like a signature) from the user's wallet during a transaction.
-   You can use any cryptographic scheme you can implement in Noir to validate transactions.

In the next section, we'll write the TypeScript "glue code" needed to deploy this contract and use it as a real account from a Node.js application. 