## 7. The BUILD (Part 2): Noir for Aztec Smart Contracts & SDK 🏗️

We've covered Noir as a general ZK language. Now, let's see how it's specifically used to write **Aztec smart contracts** and how the **Aztec SDK (TypeScript)** allows us to interact with these contracts.

### Noir Standard Library (`std`): Essential Tools

Noir provides a standard library (`std`) with common functionalities, many of which are crucial for cryptographic operations within ZK circuits. When writing Aztec contracts, you'll often use parts of this `std` lib, or specialized libraries provided by Aztec (`dep::aztec::...`).

* **Key `std` Modules (Conceptual - actual paths/names might vary with Noir versions):**
    * **`std::hash`:**
        * **Pedersen Hash:** A ZK-friendly hash function. Unlike SHA256 (which is very expensive in constraints), Pedersen hashes are designed to be efficient within circuits. Used extensively in Aztec for:
            * **Note Commitments:** Hashing note contents to create a short, unique identifier.
            * **Nullifiers:** Deriving a unique nullifier from a note's secret.
            * **Merkle Trees:** Calculating hashes at each level of the tree.
        * **Example:**
            ```noir
            use std::hash::pedersen; // Path might differ

            fn calculate_commitment(value: Field, owner_pub_key: Field, secret: Field) -> Field {
                // Pedersen takes an array of Fields
                let inputs = [value, owner_pub_key, secret];
                return pedersen::hash(inputs); 
            }
            ```
    * **`std::merkle`:**
        * Functions for **verifying Merkle proofs**. You typically don't build large Merkle trees *inside* a Noir circuit (too many constraints). Instead, the tree exists off-circuit (managed by the PXE or network state).
        * A private function might take a `leaf`, its `index`, a `merkle_path` (array of sibling hashes), and the known `root` as inputs. The `std::merkle::verify_membership` function would then recompute the root from these inputs and `assert` it matches the provided `root`.
    * **`std::encryption` / `std::cipher`:**
        * Functions for symmetric encryption/decryption (e.g., AES-like, or simpler ZK-friendly ciphers). Used by the PXE to encrypt notes for specific viewing keys.
    * **`std::ecdsa` / `std::signature`:**
        * Potentially functions for verifying digital signatures (like ECDSA) *inside* a circuit. This is very constraint-intensive but sometimes necessary (e.g., to prove an L1 action was authorized). Often relies on FFI or highly optimized lookup tables.
    * **Utilities:** Basic math, array manipulations, etc.

* **Aztec Specific Libraries (`dep::aztec`):**
    * Aztec provides its own Noir libraries that build upon `std` and offer abstractions specific to the Aztec protocol. These include:
        * Types for `Note`, `NoteHeader`, `Context`.
        * Interfaces for interacting with Aztec `storage`.
        * Functions for enqueuing public calls, emitting events, etc.

### Writing Testable Noir Code (`#[test]`)

Before deploying any smart contract, rigorous testing is paramount, especially with ZK circuits where bugs can be subtle and hard to find. Noir has built-in support for unit testing.

* **Annotation:** Mark a function with `#[test]` to designate it as a test case.
* **Assertions:** Use `assert()` within your test functions to check for expected outcomes. If an `assert` fails, the test fails.
* **Running Tests:** Use the `nargo test` command. Nargo will discover and run all `#[test]` functions in your project.
* **Example (Testing a simple DAO function):**
    ```noir
    // In our DAO contract...
    struct Proposal {
        id: Field,
        yes_votes: u64,
        no_votes: u64,
        is_active: bool,
    }

    fn can_proposal_pass(proposal: Proposal, required_quorum: u64, approval_threshold_percent: u64) -> bool {
        if !proposal.is_active {
            return false;
        }
        let total_votes = proposal.yes_votes + proposal.no_votes;
        if total_votes < required_quorum {
            return false; // Didn't meet quorum
        }
        // Check if yes_votes are >= threshold % of total_votes
        // (Note: Percentage math in ZK can be tricky due to no native division/floats.
        //  Usually done with scaled integers and careful multiplication/comparison.)
        // Simplified:
        if proposal.yes_votes * 100 >= approval_threshold_percent * total_votes {
            return true;
        }
        return false;
    }

    #[test]
    fn test_proposal_passing_logic() {
        let active_passing_proposal = Proposal {id: 1, yes_votes: 60, no_votes: 40, is_active: true};
        let active_failing_proposal_quorum = Proposal {id:2, yes_votes: 10, no_votes: 5, is_active: true};
        let active_failing_proposal_threshold = Proposal {id:3, yes_votes: 50, no_votes: 50, is_active: true};
        let inactive_proposal = Proposal {id:4, yes_votes: 70, no_votes: 30, is_active: false};

        let quorum = 50;
        let threshold = 51; // Needs > 50% yes votes

        assert(can_proposal_pass(active_passing_proposal, quorum, threshold) == true);
        assert(can_proposal_pass(active_failing_proposal_quorum, quorum, threshold) == false); // Fails quorum
        assert(can_proposal_pass(active_failing_proposal_threshold, quorum, threshold) == false); // Fails threshold
        assert(can_proposal_pass(inactive_proposal, quorum, threshold) == false); // Inactive
    }
    ```

### Aztec Smart Contracts: Private & Public Functions

This is where the hybrid nature of Aztec comes alive. Aztec smart contracts, written in Noir, can have both private and public functions.

* **The `#[contract]` Annotation:**
    You typically define your Aztec contract logic within a Noir module annotated with `#[contract]`.
    ```noir
    #[contract]
    mod MyDAAContract {
        // ... imports, storage, structs, functions ...
    }
    ```

* **Private Functions (`#[aztec(private)]`):**
    * **Execution:** Run *locally* within the user's **PXE**.
    * **State Access:** Can read and write the user's **private state** (their encrypted notes). They can create new notes and nullify existing ones.
    * **Proof Generation:** The PXE generates a ZK proof for the correct execution of this private function. This proof is submitted to the Aztec network.
    * **Interaction with Public:** Can *enqueue* calls to public functions of the same contract or other contracts. They *cannot* directly call a public function and get a return value in the same private execution step (due to the directional flow).
    * **Inputs:** Can take private inputs (from the user) and public inputs (e.g., parameters passed from the dApp).
    * **Purpose:** Handle all logic that requires confidentiality: checking private balances, verifying private credentials, making private choices (like a vote).
    * **Example (Simplified DAO `join_privately`):**
        ```noir
        // Inside #[contract] mod MyDAAContract
        
        // Assume 'Storage' struct is defined, including 'member_commitments_root: Field'
        // Assume 'MembershipNote' struct is defined
        // Assume 'context: Context' is implicitly available or passed

        #[aztec(private)]
        fn join_privately(new_member_key: Field, membership_fee_note: Note, fee_note_merkle_proof: [Field; 32], fee_note_header: NoteHeader) {
            // 1. Verify 'membership_fee_note' is valid, owned, and sufficient (using Merkle proof, nullifier check)
            //    This involves proving ownership of 'membership_fee_note', checking its value,
            //    calculating its nullifier, and asserting the nullifier is not yet in the nullifier set.
            //    Then, add the nullifier to the transaction's effects.
            //    (This logic is complex and abstracted here)
            //    context.nullify_note(fee_note_header.commitment, fee_note_header.secret_for_nullifier);

            // 2. Create a new 'MembershipNote' for the new_member_key
            let new_membership_secret = context.random_field(); // Get randomness from PXE
            let new_membership_note_commitment = std::hash::pedersen::hash([new_member_key, new_membership_secret]);
            
            // 3. Add this new note commitment to the transaction's effects (to be added to the Note Hash Tree)
            //    context.emit_new_note(new_membership_note_commitment, /* ... other note metadata ... */);

            // 4. Optionally, enqueue a public function to log the new member count (publicly)
            context.enqueue_public_fn(MyDAAContract::increment_public_member_count, []); 
        }
        ```

* **Public Functions (`#[aztec(public)]`):**
    * **Execution:** Run by the **Aztec Sequencer/AVM** on the L2 network.
    * **State Access:** Can read and write **public state** of the contract. They *cannot* directly access or decrypt private notes.
    * **Interaction with Private:** Can be called by users directly (if designed that way) or, more commonly, are *enqueued* by a proven private function.
    * **Inputs:** Take public inputs.
    * **Purpose:** Handle logic that needs to be transparent or update global public state: recording final vote tallies, managing public registries, interacting with L1 bridges.
    * **Example (Simplified DAO `increment_public_member_count`):**
        ```noir
        // Inside #[contract] mod MyDAAContract
        // Assume 'Storage' struct is defined, including 'public_member_count: Map<Field, u64>'
        // (Using a Map here for simplicity, could be a single Field if only one counter)
        
        #[aztec(public)]
        fn increment_public_member_count() {
            let contract_id_for_map: Field = 0; // Or some other identifier
            let current_count = storage.public_member_count.at(contract_id_for_map).read_or(0);
            storage.public_member_count.at(contract_id_for_map).write(current_count + 1);
        }
        ```

* **The `Context` Object:**
    * Aztec Noir functions (especially private ones) often get a `context: Context` object injected.
    * This `Context` provides access to essential functionalities needed during private execution within the PXE:
        * Reading from contract storage (both private for simulation and public).
        * Generating randomness (for note secrets, etc.).
        * Accessing block information (e.g., current block number).
        * Functions to specify transaction effects:
            * `context.emit_new_note(...)`
            * `context.nullify_note(...)`
            * `context.enqueue_public_fn(...)`

### State Management in Aztec Contracts

Aztec's hybrid state model means managing both public and private data.

* **Public State:**
    * Stored transparently on the Aztec L2 network, managed by the Sequencer and AVM.
    * Accessible and modifiable by public functions.
    * Typically defined in the `storage` struct of a Noir contract using types like `Map<KeyType, ValueType>` or simple `Field`, `u64`, etc.
    * **Analogy:** A public bulletin board where everyone can see and (if authorized by the contract) update information.
    * **Example (DAO):**
        ```noir
        storage struct DaoPublicStorage {
            // Key: proposal_id, Value: number of yes votes
            proposal_yes_votes: Map<Field, u64>, 
            // Key: proposal_id, Value: number of no votes
            proposal_no_votes: Map<Field, u64>,
            // The current root of the Merkle tree containing all member commitments
            // This is public so private functions can use it to verify membership proofs.
            member_commitment_tree_root: Field, 
        }
        ```

* **Private State (Notes/UTXOs):**
    * As discussed before, private data is stored as encrypted **Notes** in the global Note Hash Tree.
    * Private functions operate on these notes by:
        1.  **Reading/Consuming:** The user's PXE finds relevant notes, decrypts them, and uses their content. The function then proves ownership and validity, and generates a **nullifier** for each consumed note.
        2.  **Creating:** The function defines the content for new notes, which are then encrypted by the PXE and their commitments are added to the Note Hash Tree.
    * **No Direct "Storage" in Noir for Private Notes:** The Noir contract logic *defines the structure* of a note (e.g., a `struct MembershipNote`) and the *rules* for creating/nullifying them. The actual storage and encryption happen within the PXE and the Aztec protocol's trees.
    * **Analogy:** Your physical wallet. The "contract" is the set of rules for how you use your cash (notes). You don't store the cash *in* the rulebook; you hold it, and the rulebook describes how you can spend it and get change.

### Introduction to the Aztec SDK (TypeScript)

The Aztec SDK (`aztec.js` and related packages) is a TypeScript library that allows frontend dApps, scripts, or backend services to interact with the Aztec network and deployed Aztec smart contracts.

* **Key Responsibilities of the SDK:**
    1.  **RPC Client:** Connecting to an Aztec Node (which provides an RPC interface to the network, similar to Geth/Infura for Ethereum).
    2.  **Wallet/Account Management:** Interacting with the user's PXE (which might be embedded in a browser extension wallet or run locally) to:
        * Get user accounts.
        * Request signatures for transactions.
        * Trigger private proof generation within the PXE.
    3.  **Contract Interaction:**
        * **Deployment:** Deploying compiled Noir contracts (ACIR artifacts) to the Aztec network.
        * **Function Calls:** Constructing and sending transaction requests to call both private and public functions on deployed contracts.
        * **View Calls:** Reading public state from contracts without sending a transaction.
    4.  **Event Handling:** Listening for events emitted by smart contracts.
    5.  **Note Management (Higher-level abstractions):** While the core PXE handles note discovery, the SDK might provide utilities to help dApps manage or query notes relevant to the user.

* **Core SDK Classes/Concepts:**
    * `AztecRPC`: Represents the connection to an Aztec Node's RPC endpoint.
        ```typescript
        import { AztecRPC } from '@aztec/aztec.js';
        const rpcUrl = 'http://localhost:8080'; // For local Sandbox
        const rpc = new AztecRPC(rpcUrl);
        ```
    * `AccountWallet` / `Wallet`: Represents a user's account and provides methods to sign and send transactions. It's typically created from an `AztecRPC` instance and an account identifier.
        ```typescript
        import { getSandboxAccounts, createAccount, CheatCodes } from '@aztec/aztec.js'; // Example imports

        // For local sandbox, you might get pre-funded accounts
        const accounts = await getSandboxAccounts(rpc);
        const myAccount = accounts[0]; // An object with address, public key etc.
        const wallet = myAccount.getWallet(); // Simplified
        ```
    * **Contract Artifacts & Typed Contract Classes:**
        When you compile a Noir contract with `nargo compile --contract` (or similar Aztec-specific compilation), it generates a JSON artifact. The Aztec SDK can use this artifact to create a typed TypeScript class representing your contract.
        ```typescript
        // Assuming 'PrivateDao.json' is your compiled artifact
        // And you've run a codegen step or the SDK provides a way to load it:
        import { PrivateDaoContract } from './artifacts/PrivateDao.js'; // This is a generated class

        // Get an instance of a deployed contract
        const daoContractAddress = /* ... address of your deployed DAO ... */;
        const dao = await PrivateDaoContract.at(daoContractAddress, wallet);
        ```
    * **Calling Methods:**
        ```typescript
        // Calling a private function (example)
        const proposalId = 123n; // Use BigInt for Field types
        const voteChoice = true;
        // ... (need to get membershipNote, proof, header - complex part)
        const privateTx = dao.methods.join_privately(/* ...args... */).send();
        const privateTxReceipt = await privateTx.wait(); // Wait for mining
        console.log('Private vote cast, tx hash:', privateTxReceipt.txHash.toString());

        // Calling a public function (example)
        const publicTx = dao.methods.increment_public_member_count().send();
        const publicTxReceipt = await publicTx.wait();
        console.log('Public member count incremented:', publicTxReceipt.txHash.toString());

        // Calling a view function (read-only)
        const currentMemberCount = await dao.methods.get_public_member_count().view();
        console.log('Current public member count:', currentMemberCount);
        ```

### Bridging Assets to Aztec (Conceptual)

For users to have private assets (like private ETH or private DAI) on Aztec L2, these assets need to be "bridged" from Ethereum L1.

* **The Process:**
    1.  **L1 Portal/Bridge Contract:** Aztec will have smart contracts deployed on Ethereum L1 that act as portals or bridges.
    2.  **Deposit on L1:** A user sends their L1 assets (e.g., ETH, ERC20 tokens) to this L1 portal contract. The L1 contract locks these assets.
    3.  **Message to L2:** The L1 portal contract emits an event or sends a message (via a cross-chain communication mechanism) to the Aztec L2 network, indicating the deposit.
    4.  **Minting on L2:** An Aztec Sequencer (or a dedicated bridge relayer) picks up this message.
        * If the user wants a **public L2 balance**, the corresponding amount of a public L2 representation of the asset is minted to their L2 account.
        * If the user wants **private L2 notes**, the Sequencer (or the user's PXE in a subsequent step) facilitates the creation of new, encrypted private notes on Aztec L2 representing that value, owned by the user.
    5.  **Withdrawal from L2:**
        * The user initiates a withdrawal on Aztec L2.
        * If they have private notes, they "burn" them (nullify them and prove their value) in a private transaction.
        * This private transaction enqueues a public action to signal the withdrawal.
        * The Aztec L2 sends a message back to the L1 portal contract.
    6.  **Release on L1:** The L1 portal contract verifies the message from L2 and releases the corresponding locked L1 assets back to the user's L1 address.

* **Privacy:** While the deposit to L1 and withdrawal from L1 are public events on Ethereum, **what the user does with those assets once they are private notes on Aztec L2 remains confidential.** The link between the L1 deposit/withdrawal and the subsequent private L2 activity is broken (or significantly obscured).

This bridging mechanism is vital for bringing liquidity and utility into the private Aztec ecosystem. 