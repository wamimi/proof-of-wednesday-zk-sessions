# Guide: Deploying and Interacting with the Counter Contract

This is a step-by-step guide to create, compile, deploy, and interact with the private Counter contract on the local Aztec Sandbox. Follow these commands exactly to get up and running quickly.

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

Open the `Nargo.toml` file in the `counter` directory. Replace the entire `[dependencies]` section with the following block:

```toml
[dependencies]
aztec = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/aztec" }
value_note = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/value-note"}
easy_private_state = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/easy-private-state"}
```

---

### Step 3: Write the Smart Contract Code

Open `src/main.nr` and **replace its entire contents** with the following complete code for the Counter contract.

```rust
use dep::aztec::macros::aztec;

#[aztec]
pub contract Counter {
    use aztec::macros::{
        functions::{initializer, private, public, utility},
        storage::storage,
    };
    use aztec::prelude::{AztecAddress, Context, Map, Note, Set};
    use aztec::protocol_types::{
        abis::function_selector::FunctionSelector,
        traits::{FromField, ToField},
    };
    use easy_private_state::EasyPrivateUint;
    use value_note::{balance_utils, value_note::ValueNote};

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

    #[utility]
    unconstrained fn get_counter(owner: AztecAddress) -> Field {
        let counters = storage.counters;
        balance_utils::get_balance(counters.at(owner).set)
    }

    // These functions are included in the tutorial for demonstration of other concepts
    // but are not core to the counter functionality.
    #[private]
    fn increment_self_and_other(
        other_counter: AztecAddress,
        owner: AztecAddress,
        sender: AztecAddress,
    ) {
        let counters = storage.counters;
        counters.at(owner).add(1, owner, sender);
        Counter::at(other_counter).increment(owner, sender).call(&mut context);
    }

    #[public]
    fn emit_in_public(n: Field) {
        context.push_note_hash(n);
    }
}
```

---

### Step 4: Compile the Contract

Now, compile your Noir code. This command reads `src/main.nr`, and if successful, it creates a JSON artifact in the `target/` directory named `counter-Counter.json`.

```bash
aztec-nargo compile
```

---

### Step 5: Get Your Account Address

You'll need an account to deploy and own the contract. We'll use the pre-funded `test0` account. Run the following command to see its details.

```bash
aztec-wallet get-accounts
```

From the output, find the `test0` account and copy its `Address` (the long value that starts with `0x...`). We will refer to this as `YOUR_ACCOUNT_ADDRESS` in the next steps.

---

### Step 6: Deploy the Contract

Deploy the contract to your local sandbox. This command does three things:
1.  It points to the compiled artifact (`target/counter-Counter.json`).
2.  It passes constructor arguments (`--args`): an initial count of `42` and `YOUR_ACCOUNT_ADDRESS` as the owner.
3.  It gives the deployed contract a convenient alias, `counter`, using the `-a` flag.

```bash
# Replace YOUR_ACCOUNT_ADDRESS with the real address you copied in Step 5
aztec-wallet deploy target/counter-Counter.json --args 42 YOUR_ACCOUNT_ADDRESS -a counter
```

Wait for the command to finish and for the transaction to be mined.

---

### Step 7: Check the Initial Private Count

Let's check your private counter's value. The `simulate` command performs a read-only query without creating a new transaction.

```bash
# Replace YOUR_ACCOUNT_ADDRESS with your address
aztec-wallet simulate get_counter --contract-address counter --args YOUR_ACCOUNT_ADDRESS
```

The terminal should show `Simulation result: 42n`. The `n` indicates it's a BigInt.

---

### Step 8: Increment the Counter

Now, let's send a transaction to call the `increment` function. This is a private transaction that will require generating a proof. The arguments are `(owner, sender)`. For this simple case, we'll use your address for both.

```bash
# Replace YOUR_ACCOUNT_ADDRESS with your address in BOTH places
aztec-wallet send increment --contract-address counter --args YOUR_ACCOUNT_ADDRESS YOUR_ACCOUNT_ADDRESS
```

Wait for the transaction to be mined.

---

### Step 9: Check the New Private Count

Check the value again. It should have increased by one.

```bash
# Replace YOUR_ACCOUNT_ADDRESS with your address
aztec-wallet simulate get_counter --contract-address counter --args YOUR_ACCOUNT_ADDRESS
```

The terminal should now show `Simulation result: 43n`.

---

**Congratulations! You have successfully created, deployed, and privately interacted with your first Aztec smart contract.** 