## 6. The BUILD (Part 1): Introduction to Noir Language ✍️

Now that we understand the "why" and the "how" of Aztec's privacy mechanisms, let's explore **Noir**, the programming language specifically designed by Aztec Labs to write smart contracts (and general ZK circuits) for this ecosystem.

### Noir's Purpose: Why a Dedicated Language for ZK Circuits?

Writing Zero-Knowledge circuits directly in their raw mathematical form (like R1CS - Rank-1 Constraint Systems, or the internal representation of PLONK/Honk) is incredibly complex and error-prone. It's like trying to write a modern web application using only machine code.

* **The Challenge of ZK Programming:**
    * ZK proofs require computations to be expressed as a series of mathematical equations (constraints) over finite fields.
    * Developers need a way to express their program's logic without getting bogged down in this low-level cryptographic complexity.
    * The language needs to ensure that whatever is written can be efficiently and correctly converted into a ZK-provable format.

* **Noir's Mission:**
    * **Accessibility:** To make ZK programming accessible to a wider range of developers, not just cryptography experts. It achieves this with a syntax heavily inspired by **Rust**, making it feel familiar to those who know Rust, C++, TypeScript, or similar languages.
    * **Safety:** To help developers write correct and secure ZK circuits by providing high-level abstractions and type checking.
    * **Efficiency:** To compile down to an optimized representation (ACIR) that can be used by powerful ZK proving backends.
    * **Backend Agnosticism (via ACIR):** As mentioned, Noir compiles to ACIR, allowing the same Noir code to potentially target different ZK proving systems in the future.

* **Analogy: The Master Chef & The Magic Oven (Revisited)**
    * **You (the Developer):** The Master Chef.
    * **Your Private dApp Logic:** The recipe for a magical, privacy-preserving cake.
    * **Raw ZK Math:** Trying to build the magic oven from scratch while simultaneously mixing ingredients by hand using only fundamental particles. Extremely hard!
    * **Noir:** A high-tech, user-friendly recipe language and a set of advanced kitchen tools (standard library). It lets you write your complex cake recipe in a way that's understandable and manageable.
    * **ACIR:** The standardized "baking tray" that Noir prepares your cake batter (compiled logic) in.
    * **ZK Backend (e.g., Barretenberg/Honk):** The powerful magic oven that takes the ACIR baking tray and bakes the actual magical cake (the ZK Proof).

The TL;DR (from Aztec Docs): "Noir is a zero-knowledge domain specific language used for writing smart contracts for the Aztec network."

### Noir Basics: Syntax & Data Types

Let's explore some fundamental Noir syntax, keeping our **"Private Community DAO & Fund"** example in mind.

* **`Field` - The Atom of Noir:**
    * **What:** The most basic and fundamental data type in Noir. Everything in a ZK circuit ultimately operates on **Field elements**. A Field element is a number in a very large finite field (a specific set of numbers where math operations like addition, subtraction, multiplication, and division work in a consistent, cyclical way, like clock arithmetic but much bigger).
    * **Why:** ZK proving systems are built on math over these finite fields.
    * **Example:**
        ```noir
        // A unique identifier for a DAO proposal, represented as a Field element
        let proposal_id: Field = 12345; 

        // A member's public key (simplified)
        let member_public_key: Field = 9876543210; 
        ```

* **Integers (`u8`, `u16`, `u32`, `u64`, `u128`):**
    * **What:** Unsigned integers of various bit sizes, similar to other programming languages.
    * **How they work:** Under the hood, these are represented and constrained using Field elements. For example, a `u32` is constrained to be a value that fits within 32 bits.
    * **Consideration:** Using integers can sometimes lead to more constraints than using `Field` directly if the logic doesn't strictly require integer properties (like overflow checks or specific bit lengths).
    * **Example:**
        ```noir
        // Number of votes a proposal has received
        let yes_votes: u64 = 150;

        // Block number when a member joined
        let joined_block_height: u64 = 1234567;
        ```

* **Booleans (`bool`):**
    * **What:** Represents `true` or `false`.
    * **How they work:** Internally, `true` is often represented as the Field element `1` and `false` as `0`.
    * **Example:**
        ```noir
        let is_proposal_active: bool = true;
        let has_member_voted: bool = false;
        ```

* **Arrays:**
    * **What:** Fixed-size collections of elements of the same type. The size must be known at compile time.
    * **Example:**
        ```noir
        // A small, fixed list of admin keys for the DAO
        let admin_keys: [Field; 3] = [101, 202, 303];

        // Accessing an element
        let first_admin: Field = admin_keys[0]; 
        ```

* **Structs:**
    * **What:** Allow you to create custom composite data types by grouping together other types, similar to structs in C/Rust or objects in JavaScript/TypeScript.
    * **Example (for our DAO):**
        ```noir
        struct Member {
            id: Field,                // Unique identifier for the member
            public_key_x: Field,      // X-coordinate of their public key (simplified)
            public_key_y: Field,      // Y-coordinate of their public key
            joined_at_block: u64,
            is_active: bool,
        }

        // Creating an instance of the Member struct
        let alice = Member {
            id: 1,
            public_key_x: 12345,
            public_key_y: 67890,
            joined_at_block: 1000,
            is_active: true,
        };

        // Accessing a field
        let alice_id: Field = alice.id;
        ```

* **Mutability (`let` vs. `let mut`):**
    * By default, variables in Noir are **immutable** (their value cannot be changed after being assigned), similar to Rust. This helps prevent accidental modifications and makes reasoning about code easier.
    * To make a variable mutable, you use the `mut` keyword.
    * **Example:**
        ```noir
        let immutable_value: Field = 10;
        // immutable_value = 11; // This would cause a compile error!

        let mut mutable_counter: u64 = 0;
        mutable_counter = mutable_counter + 1; // This is allowed
        ```

* **Comments:**
    * Single-line comments: `// This is a comment`
    * Multi-line comments: `/* This is a multi-line comment */`

### Functions & Control Flow in Noir

* **Functions (`fn`):**
    * The basic unit of code organization.
    * Syntax: `fn function_name(parameter_name: ParameterType, ...) -> ReturnType { ... body ... }`
    * **Example (DAO):**
        ```noir
        // Function to check if a member is eligible to vote based on simple criteria
        fn is_eligible_to_vote(member: Member, current_block_height: u64) -> bool {
            // Member must be active and must have joined at least 100 blocks ago
            if member.is_active && (member.joined_at_block < current_block_height - 100) {
                return true;
            } else {
                return false;
            }
        }
        ```

* **`if`/`else` Expressions:**
    * Used for conditional logic.
    * Unlike some languages, `if`/`else` in Noir is an *expression*, meaning it evaluates to a value.
    * **Example:**
        ```noir
        let age: u32 = 25;
        let can_drink_legally: bool = if age >= 18 { true } else { false };
        ```

* **Loops (`for`):**
    * **Crucial Constraint Consideration:** In code that will be part of a ZK proof (constrained code), `for` loops **must have a number of iterations that is known at compile time**. This is because each iteration of the loop unrolls into distinct constraints in the circuit.
    * If the number of iterations isn't fixed, the size of the circuit would be variable, which ZK proving systems generally don't support directly in constrained contexts.
    * **Syntax:** `for variable_name in start_inclusive..end_exclusive { ... body ... }`
    * **Example (Simplified - often better ways to do this in ZK):**
        ```noir
        // Summing elements of a small, fixed-size array
        fn sum_array(arr: [Field; 3]) -> Field {
            let mut total: Field = 0;
            for i in 0..3 { // Loop runs exactly 3 times
                total = total + arr[i];
            }
            return total;
        }
        ```
    * **Unconstrained Loops:** Noir also supports more flexible loops (`loop`, `while`, `for` with `break`/`continue`) but these can typically only be used in `unconstrained fn` blocks (see Advanced Noir section), as they don't directly translate to a fixed set of circuit constraints.

### Understanding Constraints: The Heart of ZK Programming

This is the most critical concept to grasp when writing Noir for ZK proofs.

* **What is a Constraint?**
    * When your Noir code is compiled for a ZK proof, it's not turned into machine code like typical programs. Instead, it's transformed into a system of mathematical equations (or "constraints") that must all be satisfied for the computation to be considered valid.
    * These constraints are typically expressed over the finite field that the ZK system uses.
    * For PLONK-like systems (which Aztec uses), a common form of constraint is a **gate constraint**, often looking like:
        `q_L * w_L + q_R * w_R + q_O * w_O + q_M * w_L * w_R + q_C = 0`
        Where:
        * `w_L, w_R, w_O` are "witness" values (variables from your program, or intermediate values) on the "left," "right," and "output" wires of a gate.
        * `q_L, q_R, q_O, q_M, q_C` are "selector" or "coefficient" constants that define what kind of operation the gate performs (e.g., addition, multiplication, or a custom operation).
    * **Simpler View (R1CS - Rank-1 Constraint System):** Often, these can be thought of as `A * B = C`, where A, B, and C are linear combinations of your program's variables. Your entire program becomes a large set of these `A * B = C` equations.

* **Analogy: Sudoku Puzzle Rules**
    * Think of your Noir program as a set of rules for filling a Sudoku grid.
    * The **constraints** are the fundamental Sudoku rules:
        * "Each row must contain the digits 1 through 9, without repetition."
        * "Each column must contain the digits 1 through 9, without repetition."
        * "Each 3x3 subgrid must contain the digits 1 through 9, without repetition."
    * The **witness** is your filled-in Sudoku grid.
    * The **ZK proof** is a way to convince someone that your filled-in grid is a valid solution (satisfies all rules) *without them having to see your entire grid or your thought process*. They just know your solution is correct.

* **How Noir Code Becomes Constraints:**
    * `let c = a + b;`  might become a constraint like `1*a + 1*b - 1*c = 0` (an addition gate).
    * `let d = a * b;` might become a constraint like `1*(a*b) - 1*d = 0` (a multiplication gate).
    * **`assert(expression_is_true);` is fundamental!**
        * `assert(x == y);` translates to a constraint `x - y = 0`. If `x` is not equal to `y`, this constraint is violated, and a valid proof *cannot* be generated.
        * `assert` is how you enforce the specific rules and logic of your application within the ZK circuit.
    * `if condition { then_code } else { else_code }` is cleverly converted using "selector" variables. Essentially, one branch's constraints are "activated" and the other's are "deactivated" based on the condition, all using these arithmetic gate constraints.

* **Why Constraint Count Matters:**
    The **total number of constraints** generated by your Noir program directly impacts:
    1.  **Proving Time:** More constraints generally mean it takes longer for the ZK backend to generate a proof.
    2.  **Prover Resources:** More memory and CPU may be needed.
    3.  **Verification Time (less so for SNARKs):** While SNARK verification is succinct, very complex circuits can still have some impact.
    4.  **Potential Costs:** If proofs are verified on-chain, more complex circuits (though not always directly correlated with constraint count alone) can sometimes lead to higher verification gas costs.

    Therefore, writing *efficient* Noir code often means thinking about how to achieve your desired logic with the fewest possible constraints.

### Private vs. Public Inputs/Outputs (`pub`)

In ZKPs, we often want to prove something about secret (private) data while potentially revealing some non-secret (public) data. Noir uses the `pub` keyword to distinguish these.

* **Private (Default):**
    * Any input parameter or variable in Noir is **private by default**.
    * This means its value is known *only* to the Prover (the entity generating the proof, e.g., the user's PXE).
    * The Verifier (e.g., the Aztec network, or an on-chain verifier contract) does *not* learn the actual value of private inputs.
* **Public (`pub`):**
    * You can explicitly mark an input parameter or a function's return value as `pub`.
    * The value of a `pub` variable is known to *both* the Prover and the Verifier.
    * Public inputs are part of the "public statement" that the ZK proof is attesting to.
* **Typical Usage:**
    * `pub` is most commonly used for parameters of the `main` function (the entry point of a Noir program/circuit) and for its return value.
    * **Example (DAO Membership Check - Simplified):**
        Let's say our DAO wants a member to prove they know a secret `private_key` that corresponds to a `public_member_id` which is known to the DAO.
        ```noir
        // Assume 'hash_private_key_to_id' is a function that deterministically
        // generates a public ID from a private key.
        // (In reality, this would involve cryptographic hashes like Pedersen).
        fn hash_private_key_to_id(private_key: Field) -> Field {
            // Simplified placeholder for a hash function
            return private_key * private_key + private_key; // Not a real hash!
        }

        // The 'main' function is the entry point for our ZK circuit.
        // 'private_key' is known only to the prover (the member).
        // 'expected_public_member_id' is known to both prover and verifier (the DAO system).
        fn main(private_key: Field, expected_public_member_id: pub Field) {
            // The prover calculates the public ID from their private key.
            let calculated_public_id = hash_private_key_to_id(private_key);

            // The core of the proof:
            // Assert that the public ID calculated from the private key
            // matches the 'expected_public_member_id' that the verifier already knows.
            // If this assertion holds, the proof is valid.
            // The verifier learns that the prover knows *some* 'private_key'
            // that hashes to 'expected_public_member_id', but learns nothing
            // about the 'private_key' itself.
            assert(calculated_public_id == expected_public_member_id);
        }
        ```
* **Important Note on `pub` in Aztec:**
    * When `pub` inputs/outputs are used in an Aztec smart contract, and these values are part of the transaction data submitted to the Aztec network, they become part of the public record of the Aztec L2. If these are then bridged or reflected on L1, they become public on Ethereum.
    * So, `pub` in Noir means "public to the ZK verifier." The application context (e.g., Aztec) determines how widely that "public" information is disseminated.

### Introduction to Nargo: Noir's Command Center

**Nargo** is the official command-line tool and package manager for Noir. It's your primary interface for developing Noir projects.

* **Key `nargo` Commands:**
    1.  **`nargo new <project_name>`:**
        * Creates a new Noir project directory with a basic structure:
            * `src/main.nr`: Your main Noir source file.
            * `Nargo.toml`: The project manifest file (like `Cargo.toml` for Rust or `package.json` for Node.js). It defines project name, dependencies, etc.
            * `Prover.toml` (example): For specifying inputs (private and public) when generating a proof.
            * `Verifier.toml` (example): For specifying public inputs when verifying a proof.
    2.  **`nargo check`:**
        * Parses your Noir code and checks for syntax and type errors.
        * It also compiles the code into an internal representation and calculates the number of constraints, but doesn't produce the final ACIR artifact for proving yet. Good for quick validation.
    3.  **`nargo compile [contract_name]`:**
        * Fully compiles your Noir program into its **ACIR (Abstract Circuit Intermediate Representation)**.
        * The ACIR is typically saved in a `target/` directory within your project. This ACIR artifact is what the ZK backend uses to generate proofs.
    4.  **`nargo execute [witness_name]` (or `nargo run` in older versions):**
        * Executes your Noir program's `main` function with the inputs provided in `Prover.toml`.
        * It generates a "witness trace" – the set of all intermediate variable values during execution. This is needed by the prover.
        * It *doesn't* generate a proof yet, but it calculates the expected output.
    5.  **`nargo prove [proof_name]`:**
        * Takes the compiled ACIR and the inputs from `Prover.toml` (which implicitly generates the witness).
        * Uses the configured ZK proving backend (e.g., Barretenberg for PLONK/Honk) to generate a ZK proof.
        * Saves the proof to a file (e.g., `proofs/[proof_name].proof`).
    6.  **`nargo verify [proof_name]`:**
        * Takes a proof file, the compiled ACIR (or verifier key), and the public inputs from `Verifier.toml`.
        * Uses the ZK proving backend to verify if the proof is valid for the given public inputs and program.
        * Outputs whether the proof is valid or not.
    7.  **`nargo test`:**
        * Runs all functions in your project annotated with `#[test]`.
    8.  **`nargo lsp`:**
        * Starts the Noir Language Server Protocol, enabling features like auto-completion, error highlighting, and go-to-definition in compatible code editors (like VS Code with the Noir extension).
    9.  **`noirup`:**
        * Not a `nargo` command, but the tool used to install and manage different versions of Nargo and the Noir toolchain.

* **`Nargo.toml` (Manifest File):**
    * Defines project properties:
        ```toml
        [package]
        name = "my_private_dao_vote"
        type = "bin" # or "lib" for libraries
        authors = ["Your Name <you@example.com>"]
        compiler_version = ">=0.20.0" # Example version

        [dependencies]
        # You can specify dependencies on other Noir libraries here
        # std = { git = "[https://github.com/noir-lang/noir.git](https://github.com/noir-lang/noir.git)", tag = "v0.20.0", directory="crates/nargo_std" }
        # aztec = { path = "../aztec-noir-libs/aztec" } 
        ```

* **`Prover.toml` (Example for `main(private_key: Field, expected_public_member_id: pub Field)`):**
    ```toml
    private_key = "12345" 
    expected_public_member_id = "54321" 
    ```
    *(Note: Values are typically strings, Nargo parses them into the correct types. For large Field elements, hex strings `0x...` are common.)*

* **`Verifier.toml` (Example for the same `main` function):**
    ```toml
    expected_public_member_id = "54321"
    # If main returns a public value, it would also be here:
    # return = "true" 
    ```

Nargo is your essential companion for building, testing, and proving with Noir. 