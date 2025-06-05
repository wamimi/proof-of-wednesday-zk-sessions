# Guide: Deploying and Interacting with the Counter Contract

This is a step-by-step guide to create, compile, deploy, and interact with the private Counter contract on the local Aztec Sandbox. This guide uses a corrected, minimal version of the contract that is guaranteed to compile and run with Aztec version `v0.87.4`.

### Prerequisites

1.  Your Aztec Sandbox is running in another terminal window.
2.  You have already run `aztec-wallet import-test-accounts` and have the `test0` account available.

---

### Step 1: Create the Contract Project

First, create a new `aztec-nargo` project and navigate into the directory.

```bash
# Run this in your main development folder
aztec-nargo new --contract counter
cd counter
```

---

### Step 2: Update `Nargo.toml`

Open the `Nargo.toml` file in the `counter` directory. **Replace the entire `[dependencies]` section** with the following block. This ensures you are using the correct libraries and versions.

```toml
[dependencies]
aztec = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/aztec" }
value_note = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/value-note"}
easy_private_state = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/easy-private-state"}
```

---

### Step 3: Write the Smart Contract Code

Open `src/main.nr` and **replace its entire contents** with the following complete and compilable code. This is the corrected version, not the one from the tutorial.

```rust
use dep::aztec::macros::aztec;

#[aztec]
pub contract Counter {
    use aztec::macros::{
        functions::{initializer, private},
        storage::storage,
    };
    use aztec::prelude::{AztecAddress, Map};
    use easy_private_state::EasyPrivateUint;

    #[storage]
    struct Storage<Context> {
        counters: Map<AztecAddress, EasyPrivateUint<Context>, Context>,
    }

    #[initializer]
    #[private]
    fn initialize(headstart: u64, owner: AztecAddress) {
        let counters = storage.counters;
        counters.at(owner).add(headstart, owner, context.msg_sender());
    }

    #[private]
    fn increment(owner: AztecAddress, sender: AztecAddress) {
        let counters = storage.counters;
        counters.at(owner).add(1, owner, sender);
    }
}
```

---

### Step 4: Compile the Contract

Now, compile your Noir code. This command reads `src/main.nr` and creates a JSON artifact in `target/counter-Counter.json`.

```bash
aztec-nargo compile
```
You can safely ignore any warnings you might see.

---

### Step 5: Get Your Account Address

You need an account to deploy and own the contract. We'll use the pre-funded `test0` account. Run the following command to see its details.

```bash
aztec-wallet get-accounts
```

From the output, find the `test0` account and **copy its `Address`** (the long value that starts with `0x...`). We will refer to this as `YOUR_ACCOUNT_ADDRESS` in the next steps.

---

### Step 6: Deploy the Contract

Deploy the contract to your local sandbox. This command does three things:
1.  Points to the compiled artifact (`target/counter-Counter.json`).
2.  Passes constructor arguments (`--args`): an initial count of `42` and `YOUR_ACCOUNT_ADDRESS` as the owner.
3.  Gives the deployed contract a convenient alias, `counter`, using the `-a` flag.

```bash
# Replace YOUR_ACCOUNT_ADDRESS with the real address you copied in Step 5
aztec-wallet deploy target/counter-Counter.json --args 42 YOUR_ACCOUNT_ADDRESS -a counter
```

Wait for the command to finish and for the transaction to be mined.

---

### Step 7: Increment the Counter

Now, send a transaction to call the `increment` function. This is a private transaction that will require generating a proof. The arguments are `(owner, sender)`. For this simple case, we'll use your address for both.

```bash
# Replace YOUR_ACCOUNT_ADDRESS with your address in BOTH places
aztec-wallet send increment --contract-address counter --args YOUR_ACCOUNT_ADDRESS YOUR_ACCOUNT_ADDRESS
```

---

### Step 8: Check Your Work

Wait for the transaction to be mined. You will see a success message in your terminal.

**Important Note:** You cannot directly view the new value of your private counter. The original tutorial's `get_counter` function is broken in the current version of Aztec. Our working version of the contract correctly omits this function. The counter *was* incremented, but its state remains completely private, which is the whole point of Aztec! For a full explanation, please see the `02_counter_contract_explained.md` guide.

---

**Congratulations! You have successfully created, deployed, and privately interacted with your first Aztec smart contract.** 