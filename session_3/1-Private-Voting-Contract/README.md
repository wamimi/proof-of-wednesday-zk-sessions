# 1. Private Voting Contract Tutorial

This tutorial walks you through creating a simple private voting smart contract in Aztec.nr.

**Goal:** Build a contract where users can vote privately, but the results are tallied publicly. A key feature is using nullifiers to prevent anyone from voting more than once.

## Prerequisites

- You have followed the Aztec quickstart and have `aztec-nargo` and the `aztec` CLI installed.
- Your Aztec Sandbox is running.
- We will be using Aztec version `v0.87.4`.

## Step 1: Create a New Contract Project

In your terminal, run the `aztec-nargo` command to create a new contract project.

```bash
aztec-nargo new --contract private_voting
```

This will create a new directory `private_voting` with the standard Noir project structure.

## Step 2: Add Aztec Dependencies

Open the `Nargo.toml` file inside your `private_voting` directory. Add the `aztec` library as a dependency. Your file should look like this:

**`Nargo.toml`**
```toml
[package]
name = "private_voting"
authors = [""]
compiler_version = ">=0.23.0"
type = "contract"

[dependencies]
aztec = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/aztec" }
```

## Step 3: Write the Smart Contract

Open the `src/main.nr` file and replace its contents with the full `EasyPrivateVoting` contract code below.

**`src/main.nr`**
```rust
use dep::aztec::macros::aztec;

#[aztec]
pub contract EasyPrivateVoting {
    // Imports for Aztec functionalities
    use dep::aztec::{
        keys::getters::get_public_keys,
        macros::{functions::{initializer, internal, private, public, utility}, storage::storage},
    };
    use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
    use dep::aztec::protocol_types::traits::{Hash, ToField};

    // Defines the contract's storage variables
    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        tally: Map<Field, PublicMutable<Field, Context>, Context>,
        vote_ended: PublicMutable<bool, Context>,
        active_at_block: PublicImmutable<u32, Context>,
    }

    // Constructor: Initializes the contract state on deployment
    #[public]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        storage.admin.write(admin);
        storage.vote_ended.write(false);
        storage.active_at_block.initialize(context.block_number() as u32);
    }

    // Private function to cast a vote
    #[private]
    fn cast_vote(candidate: Field) {
        // Create a unique nullifier to prevent double-voting
        let msg_sender_npk_m_hash = get_public_keys(context.msg_sender()).npk_m.hash();
        let secret = context.request_nsk_app(msg_sender_npk_m_hash);
        let nullifier = std::hash::pedersen_hash([context.msg_sender().to_field(), secret]);
        context.push_nullifier(nullifier);

        // Enqueue a call to the public function to update the tally
        EasyPrivateVoting::at(context.this_address()).add_to_tally_public(candidate).enqueue(
            &mut context,
        );
    }

    // Public function to increment the vote count for a candidate
    #[public]
    #[internal]
    fn add_to_tally_public(candidate: Field) {
        assert(storage.vote_ended.read() == false, "Vote has ended");
        let new_tally = storage.tally.at(candidate).read() + 1;
        storage.tally.at(candidate).write(new_tally);
    }

    // Public function for the admin to end the voting period
    #[public]
    fn end_vote() {
        assert(storage.admin.read().eq(context.msg_sender()), "Only admin can end votes");
        storage.vote_ended.write(true);
    }

    // Utility function to read the vote count for a candidate
    #[utility]
    unconstrained fn get_vote(candidate: Field) -> Field {
        storage.tally.at(candidate).read()
    }
}
```

## Step 4: Compile and Generate Code

Now that the contract is written, compile it to check for errors and create the necessary artifacts for deployment.

Navigate to your `private_voting` directory in the terminal and run:

```bash
aztec-nargo compile
```

This will create a `target` directory containing the compiled contract artifact (`.json` file).

Next, generate the TypeScript interface for your contract, which makes it easy to interact with from a dApp.

```bash
aztec codegen target --outdir src/artifacts
```

This will create a `src/artifacts` directory containing the generated TypeScript files.

## Summary

Congratulations! You have successfully written, compiled, and generated code for a private voting smart contract on Aztec. You've seen how to:
- Define public and private state.
- Use a `constructor` to initialize the contract.
- Create a `#[private]` function that uses a **nullifier** to enforce a one-vote-per-person rule.
- Enable private functions to call and update public state via `enqueue`.
- Implement access control using `assert`.
- Create a `#[utility]` function to read public state from a dApp. 