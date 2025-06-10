# Deep Dive: The Private Voting Contract Explained

Welcome, builders! This document breaks down the `EasyPrivateVoting` contract line-by-line. We'll explore the core concepts of Aztec that make private voting possible, using analogies and comparisons to the EVM world you're familiar with.

## The Big Picture: How it Works

Imagine a traditional voting booth. You enter, your name is checked off a list (so you can't vote again), you cast your vote secretly, and you leave. Your vote is then added to a public tally board.

Our `EasyPrivateVoting` contract mimics this:
1.  **Private Vote (`cast_vote`)**: You call this function. It happens inside your "private booth" (your local PXE).
2.  **Check-off List (Nullifier)**: The contract generates a unique, anonymous "used-vote ticket" (a nullifier) from your private identity. It "posts" this ticket to a global board of used tickets. If you try to vote again, the system sees your ticket is already on the board and rejects your vote. Crucially, no one can link the ticket back to you.
3.  **Secret Tally Update (`enqueue`)**: Your private vote doesn't directly touch the public tally. Instead, you secretly pass a message to the "tally master" (the public part of the Aztec network) saying, "add one vote for candidate X."
4.  **Public Tally (`add_to_tally_public`)**: The tally master receives the message and publicly updates the vote count for candidate X on the main board.

---

## Code Breakdown

### `src/main.nr`

#### Imports

```rust
use dep::aztec::macros::aztec;

#[aztec]
pub contract EasyPrivateVoting {
    use dep::aztec::{
        keys::getters::get_public_keys,
        macros::{functions::{initializer, internal, private, public, utility}, storage::storage},
    };
    use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
    use dep::aztec::protocol_types::traits::{Hash, ToField};

    // ... rest of the contract
}
```

-   `#[aztec]`: This is a special instruction (a macro) for the Noir compiler. It says, "Hey, this isn't just regular code; it's an Aztec smart contract. Please enable all the special Aztec features like `context`, `storage`, etc."
-   `use dep::aztec::{...}`: These lines are like `import` statements in JavaScript or Solidity. We're pulling in all the tools we need from the Aztec library.
    -   `get_public_keys`: A helper to get public key information linked to an address, crucial for creating secure nullifiers.
    -   `macros::{...}`: These are the decorators (`#[private]`, `#[public]`, etc.) that define what kind of function we're writing.
    -   `prelude::{...}`: The "prelude" contains the most common data types you'll need:
        -   `AztecAddress`: Like an `address` in Solidity.
        -   `Map`: Like a `mapping` in Solidity.
        -   `PublicMutable`: A public state variable that can be changed (Mutable).
        -   `PublicImmutable`: A public state variable that can be set only once (Immutable).
    -   `traits::{Hash, ToField}`: Helpers for cryptographic operations, like hashing.

---

#### Storage

```rust
#[storage]
struct Storage<Context> {
    admin: PublicMutable<AztecAddress, Context>, // admin can end vote
    tally: Map<Field, PublicMutable<Field, Context>, Context>, // we will store candidate as key and number of votes as value
    vote_ended: PublicMutable<bool, Context>, // vote_ended is boolean
    active_at_block: PublicImmutable<u32, Context>, // when people can start voting
}
```
-   `#[storage]`: This macro declares the struct that holds all our contract's state variables.
-   `admin: PublicMutable<AztecAddress, Context>`: Creates a public, changeable state variable named `admin` to store an address. It's like `address public admin;` in Solidity.
-   `tally: Map<Field, PublicMutable<Field, Context>, Context>`: This is our public vote counter. It's a `mapping` from a candidate's ID (`Field`) to their vote count (`PublicMutable<Field>`). Think `mapping(uint256 => uint256) public tally;` in Solidity.
-   `vote_ended: PublicMutable<bool, Context>`: A simple public flag to turn voting on or off. Like `bool public voteEnded;` in Solidity.
-   `active_at_block: PublicImmutable<u32, Context>`: A public, **unchangeable** variable that stores the block number when voting started.
    -   **Why is this important for security?** In Aztec, users can rotate (change) their secret keys. This variable ensures that a vote is tied to the secret key that was active *at the time voting started*. Without it, a user could vote, rotate their key, and vote again with the new key, creating a different nullifier and breaking the one-vote rule. It's a clever way to anchor the vote's validity to a specific point in time.

---

#### `constructor`

```rust
#[public]
#[initializer]
fn constructor(admin: AztecAddress) {
    storage.admin.write(admin);
    storage.vote_ended.write(false);
    storage.active_at_block.initialize(context.block_number() as u32);
}
```
-   `#[public]`: This function runs on the public part of the network.
-   `#[initializer]`: Marks this as the constructor, which runs only once when the contract is deployed. Same concept as a `constructor` in Solidity.
-   `storage.admin.write(admin)`: Sets the `admin` address. `.write()` is used for `PublicMutable` variables.
-   `storage.active_at_block.initialize(...)`: Sets the immutable `active_at_block` variable. `.initialize()` is used for `PublicImmutable` variables. You can't `.write()` to them after deployment.

---

#### `cast_vote` (The Private Core)

```rust
#[private]
fn cast_vote(candidate: Field) {
    // 1. Get a component of the user's public key
    let msg_sender_npk_m_hash = get_public_keys(context.msg_sender()).npk_m.hash();

    // 2. Request the corresponding secret key from the local wallet (PXE)
    let secret = context.request_nsk_app(msg_sender_npk_m_hash);

    // 3. Create the unique, anonymous "used-vote ticket" (nullifier)
    let nullifier = std::hash::pedersen_hash([context.msg_sender().to_field(), secret]);
    
    // 4. Submit the nullifier to the network to be checked and recorded
    context.push_nullifier(nullifier);

    // 5. Secretly tell the public side to update the tally
    EasyPrivateVoting::at(context.this_address()).add_to_tally_public(candidate).enqueue(
        &mut context,
    );
}
```
-   `#[private]`: This is the magic. This entire function executes **on the user's local machine** inside their PXE. A ZK-proof of its correct execution is generated, and only that proof is sent to the network. The `candidate` you voted for is kept secret from the public chain within this function's context.

-   **Steps 1 & 2: Getting the Secret**
    -   This is how Aztec creates a secret unique to you *and* this specific contract.
    -   `get_public_keys(...)` gets a public part of your key set.
    -   `context.request_nsk_app(...)` is an **Oracle Call**. It's a special request the private circuit makes to the user's wallet (PXE) *during proof generation*. It asks, "Please give me the secret Nullifier Spending Key (NSK) that corresponds to this public key hash." Your wallet provides it securely, and it's used as a private input to the circuit.

-   **Step 3 & 4: The Nullifier**
    -   `let nullifier = std::hash::pedersen_hash(...)`: We create the nullifier by hashing the user's address with their unique `secret`. Since only the user knows their `secret`, only they can generate this specific nullifier.
    -   `context.push_nullifier(nullifier)`: This is the crucial step. The transaction tells the Aztec network, "Here is a nullifier. Please check if it's already in the global nullifier tree. If it is, reject this transaction. If not, add it." This is how double-voting is prevented without ever revealing who voted.

-   **Step 5: Private-to-Public Communication**
    -   A `#[private]` function cannot directly change a `PublicMutable` state variable.
    -   `.enqueue(&mut context)` is the bridge. It creates a message containing a request to call the `add_to_tally_public` function with the `candidate` as an argument. This message is bundled with the ZK-proof.
    -   After the network verifies your private proof, it will then execute the enqueued public function call.

---

#### `add_to_tally_public` and `end_vote`

```rust
#[public]
#[internal]
fn add_to_tally_public(candidate: Field) {
    assert(storage.vote_ended.read() == false, "Vote has ended");
    let new_tally = storage.tally.at(candidate).read() + 1;
    storage.tally.at(candidate).write(new_tally);
}

#[public]
fn end_vote() {
    assert(storage.admin.read().eq(context.msg_sender()), "Only admin can end votes");
    storage.vote_ended.write(true);
}
```
-   These are standard public functions, much like in Solidity.
-   `#[internal]`: This on `add_to_tally_public` is a security hint. It signifies that this function is *intended* to be called from within the contract itself (via an enqueue from `cast_vote`), not directly by users.
-   `assert(..., "Error message")`: This is identical to `require(...)` in Solidity. If the condition is false, the transaction reverts with the given error message.

---

#### `get_vote`

```rust
#[utility]
unconstrained fn get_vote(candidate: Field) -> Field {
    storage.tally.at(candidate).read()
}
```
-   `#[utility]` + `unconstrained`: This is a special type of read-only function. It's not part of the ZK circuit and doesn't create a transaction. You can call it from your dApp's frontend/backend to simply read public state from the network without any cost or proof generation. It's the equivalent of a `view` function in Solidity. 