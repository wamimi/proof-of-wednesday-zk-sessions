# A Developer's Guide to the Aztec Counter Contract

This document provides a comprehensive breakdown of the Aztec Counter Contract tutorial. The goal is to give you a clear, working example and also to explain the differences between this code and the code currently found in the official Aztec documentation. This will give you a solid foundation for building and for explaining these concepts to others.

## The Big Picture: What is the Counter Contract?

The Counter Contract is the "Hello, World!" of Aztec. It's a simple program that allows any user to create and manage their own **private counter**.

-   **Private**: Only you can see the value of your counter. When you increment it, no one on the network can tell it was you, or what the new value is.
-   **Own**: Each user (identified by their `AztecAddress`) gets their own independent counter within the same deployed contract.

This is a fundamental concept in Aztec because it's a perfect, simple illustration of **managing private state**.

## The Tutorial vs. Reality: A Key Learning Moment

As we discovered, the code in the official Counter Contract tutorial on the Aztec website is slightly out of sync with the library version it specifies (`v0.87.4`). This is a common and important real-world scenario when working with rapidly evolving, cutting-edge technologies.

The key issue is that the tutorial's code attempts to use functions and properties (specifically `balance_utils` and `.set`) that the Aztec developers have since made `private`—meaning they are internal to their libraries and no longer available for developers to use directly.

**This guide provides you with code that works correctly with `v0.87.4`.** We will first walk through the working code, and then we will analyze the code from the tutorial to understand exactly why it fails to compile.

## The Correct, Working Code (`src/main.nr`)

This is the complete, minimal, and compilable version of the Counter contract. This is the code you should use for your presentation and development.

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

## Code Breakdown: The Working Contract

Let's dissect the working contract piece by piece.

#### **1. Dependencies (`Nargo.toml`)**
Your project needs to pull in the necessary Aztec libraries.

```toml
[dependencies]
aztec = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/aztec" }
value_note = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/value-note"}
easy_private_state = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/easy-private-state"}
```
-   `aztec`: The core library with all the essential macros (`#[aztec]`, `#[private]`) and types.
-   `value_note`: A low-level library for managing private state as cryptographic "notes."
-   `easy_private_state`: A high-level abstraction over `value_note`. It gives us `EasyPrivateUint`, which handles all the complex note management (encryption, nullifying, etc.) for us.

#### **2. Imports (`use` statements)**
```rust
use aztec::macros::{functions::{initializer, private}, storage::storage};
use aztec::prelude::{AztecAddress, Map};
use easy_private_state::EasyPrivateUint;
```
-   `initializer`, `private`, `storage`: These are macros that declare the purpose of a function or a struct.
-   `AztecAddress`, `Map`: Core data types for user addresses and key-value storage.
-   `EasyPrivateUint`: The wrapper that makes private state management simple.

#### **3. Storage (`struct Storage`)**
This defines our contract's persistent state variables.
```rust
#[storage]
struct Storage<Context> {
    counters: Map<AztecAddress, EasyPrivateUint<Context>, Context>,
}
```
-   We declare one variable: `counters`.
-   It's a `Map` where the key is a user's `AztecAddress` and the value is their `EasyPrivateUint` private counter.

#### **4. The Constructor (`initialize` function)**
This function runs once on deployment to set the initial state.
```rust
#[initializer]
#[private]
fn initialize(headstart: u64, owner: AztecAddress) {
    let counters = storage.counters;
    counters.at(owner).add(headstart, owner, context.msg_sender());
}
```
-   `#[initializer]`: Marks this as the constructor.
-   `#[private]`: The initial state is set privately. No one can see the initial `headstart` value or the `owner`.
-   `counters.at(owner).add(...)`: This is the key method from `EasyPrivateUint`. It creates a new **private note** containing the `headstart` value and encrypts it so that only the `owner` can read it.

#### **5. The Core Logic (`increment` function)**
This is how a user interacts with their counter after deployment.
```rust
#[private]
fn increment(owner: AztecAddress, sender: AztecAddress) {
    let counters = storage.counters;
    counters.at(owner).add(1, owner, sender);
}
```
-   `#[private]`: This entire operation is private. The network only sees that *a* transaction occurred, not who sent it, what function was called, or what the state change was.
-   `counters.at(owner).add(1, ...)`: `EasyPrivateUint` handles all the complexity here:
    1.  It finds the user's existing counter note.
    2.  It creates a **nullifier** for the old note, effectively "spending" it to prevent double-spends.
    3.  It creates a **new note** with the value incremented by 1.
    4.  It encrypts the new note for the `owner`.

---

## Analysis of the Tutorial's (Non-Working) Code

Now, let's look at the functions from the official tutorial and understand why they were removed from our working example.

#### The `get_counter` function

The tutorial includes this function to read the value of a counter:
```rust
// This code DOES NOT COMPILE
#[utility]
unconstrained fn get_counter(owner: AztecAddress) -> Field {
    let counters = storage.counters;
    // The following line is the source of the error
    balance_utils::get_balance(counters.at(owner).set)
}
```
**Why it fails:** This code worked in older versions of the libraries. However, in `v0.87.4`, the developers decided that `balance_utils` and the `.set` property should be internal implementation details of the `easy_private_state` library. They made them `private`, so they can no longer be called directly from another contract. This change enhances encapsulation but breaks the tutorial's code.

**Implication:** With our corrected, working contract, you cannot publicly view a counter's value using a `simulate` call because there is no function to do so. The state is truly private.

#### Other Functions (`increment_self_and_other`, `emit_in_public`)

The tutorial also includes these functions to demonstrate more advanced concepts like cross-contract calls and emitting public events from private functions. They have been omitted from our working example *only for the sake of simplicity*. They are not broken, but they add complexity that distracts from the core goal of understanding basic private state.

This guide gives you a solid, working foundation. You now have a contract that you can compile, deploy, and interact with, and a clear explanation for why it differs from the official documentation. 