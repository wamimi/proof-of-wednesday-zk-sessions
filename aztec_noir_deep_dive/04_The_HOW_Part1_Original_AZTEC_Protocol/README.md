## 4. The HOW (Part 1): The Original AZTEC Protocol (2018 Whitepaper Insights) 📜

To truly appreciate the modern Aztec network, it's valuable to understand its origins. The 2018 whitepaper, "The AZTEC Protocol" by Dr. Zachary J. Williamson (which you have a copy of), laid the cryptographic foundations. While the technology has evolved significantly, the core problems and initial approaches are insightful.

**Disclaimer from TL;DR:**
> "...this article assumes that the reader is somewhat familiar with definitions of smart contracts, circuits, Merkle Trees, UTXO, and basic understanding of how a zk-rollup works. Reading the article without a clear understanding of these definitions is not lethal but may be uncomfortable."
*(We will define these as we go!)*

### Core Vision: Confidential Transactions for Any Asset

* **The Problem (2018):** Existing privacy coins like Monero and Zcash focused on their native currencies. There wasn't a generic way to have confidential transactions for *any* digital asset (like ERC20 tokens) on a programmable blockchain like Ethereum.
* **Aztec's Goal (2018):** To enable confidential transactions (hiding transaction values) in a generic form that could be implemented on Ethereum.

### Key Concepts from the 2018 Whitepaper

1.  **AZTEC Note (2018 Version):**
    * **Definition:** An encrypted representation of abstract value. It's the fundamental unit of private value in the system.
    * **Structure:** Comprised of elliptic curve commitments and associated keys.
        * **Viewing Key:** Allows decryption of the note to reveal its value (the "message").
        * **Spending Key:** A private key corresponding to a public key `Q` defined by the note issuer. Knowledge of this key proves ownership and is used to sign off on using the note as an input in a transaction.
    * **Analogy:** Think of it as a special, individually locked digital "piggy bank." The viewing key lets you peek inside to see the amount, and the spending key is the only key that can unlock it to combine its contents with others.

2.  **Commitment Scheme:**
    * **Purpose:** To "commit" to a secret value `k` (the note's value) without revealing `k`, in a way that is:
        * **Perfectly Hiding:** The commitment itself (the encrypted note) reveals absolutely nothing about `k`.
        * **Binding:** Once committed, the sender cannot later open it to a *different* value `k'`.
    * **The Function (2018):** `com(k; a) := (µ_k^a, µ_k^ka * h^a)`
        * `k`: The secret value (e.g., amount of tokens).
        * `a`: A random "blinding factor" chosen by the sender, ensuring different commitments to the same value look different.
        * `µ_k`, `h`: Special elliptic curve points from a "Common Reference String" (CRS) generated during a trusted setup. `µ_k = h^(1/(y-k))`, where `y` is a secret from the trusted setup.
    * **How it's Hiding:** Because `a` is random, the resulting elliptic curve points `γ = µ_k^a` and `σ = µ_k^ka * h^a` look random and don't reveal `k`.
    * **How it's Binding:** Relies on the difficulty of the **q-Strong Diffie-Hellman (q-SDH) assumption**. If someone could open a commitment to two different values, they could break this cryptographic assumption (which is believed to be very hard).

3.  **Range Proofs:**
    * **The Problem:** In confidential systems, if you can't prove your values are within a valid range (e.g., positive and not ridiculously large), you could exploit modular arithmetic to "create money" by making notes with negative or wrap-around values.
    * **Definition:** A ZK proof that a committed (hidden) value `k` lies within a predefined range `[0, k_max]` (e.g., `0` to `2^25 - 1` in the paper's implementation) without revealing `k`.
    * **AZTEC's 2018 Efficiency:** The paper details a clever range proof integrated with the commitment scheme. It relied on a pairing equation: `e(γ, t_2) = e(σ, g_2)`.
        * If `γ = µ_k^a` and `σ = µ_k^ka * h^a`, this equation holds *if and only if* `k` is within the valid range `[0, k_max]` (due to the structure of `µ_k` and `t_2 = g_2^y` from the trusted setup).
        * **Verification Cost:** Remarkably efficient – requiring only 3 elliptic curve scalar multiplications and 1 bilinear pairing comparison per proof, or even better when batching multiple proofs (4 scalar mults per proof and 1 pairing for the whole batch). This was crucial for viability on Ethereum.

4.  **Trusted Setup & Common Reference String (CRS):**
    * **The Need:** The specific range proof mechanism and the `µ_k` values in the commitment scheme required a **trusted setup** procedure.
    * **Process:** This one-time ceremony generates the public parameters `h, µ_0, ..., µ_k_max, t_2`. It involves generating a secret value `y` which *must be destroyed* afterwards. If `y` were known, fake proofs could be created.
    * **"Toxic Waste":** The secret `y` is the "toxic waste." Its secure deletion is paramount.
    * **Prover vs. Verifier:** The full CRS (including all `µ_k` points) is needed by the *Prover* to create proofs. The *Verifier* (e.g., the smart contract on Ethereum) only needs a much smaller set of parameters. This asymmetry is good for computationally constrained verifiers.
    * *(Note: Modern ZKPs like PLONK have "universal and updatable" trusted setups, and STARKs require no trusted setup at all. Aztec has evolved beyond this original setup model.)*

5.  **Sigma Protocols & The Fiat-Shamir Transform:**
    * **Sigma Protocol:** A basic 3-step interactive proof:
        1.  Prover sends a "commitment" message (`a`).
        2.  Verifier sends a random "challenge" (`c`).
        3.  Prover sends a "response" (`z`).
        The verifier then checks if `(a, c, z)` is valid for the statement.
    * **Fiat-Shamir Transform:** A standard technique to make an interactive Sigma protocol **non-interactive (NIZK)**, which is essential for blockchains.
        * **How:** Instead of the Verifier providing the random challenge `c`, the Prover computes `c` by hashing all the public information of the proof so far (e.g., `c = H(statement, commitment_message_a)`).
        * This hash acts as a pseudo-random challenge. The verifier can recompute this hash to check the proof.
        * The security relies on modeling the hash function `H` as a **Random Oracle**.

6.  **The Join-Split Confidential Transaction:**
    * **Core Transaction Type:** Modeled after Bitcoin's UTXO (Unspent Transaction Output) system but for private notes.
    * **Process (Figure 1 in the whitepaper):**
        1.  **Inputs:** A user takes one or more existing AZTEC notes they own (these are "spent").
        2.  **Outputs:** They create one or more new AZTEC notes.
        3.  **Conservation of Value:** The ZK proof accompanying the transaction guarantees that:
            `Sum of values in Input Notes = Sum of values in Output Notes`
            This is proven *without revealing any individual note's value*.
        4.  **Ownership:** The proof also implicitly proves ownership of the input notes (via the spending key, often by signing the transaction hash).
    * **Note Registry:** A system (e.g., a smart contract) is needed to keep track of which notes are "unspent" and which have been "spent" (nullified).
    * **Analogy: Private Money Transfer:** Alice has two private notes of £10 and £5. She wants to send £12 to Bob and keep £3 change.
        * **Inputs:** Alice's £10 note, Alice's £5 note.
        * **Outputs:** A new £12 note for Bob, a new £3 note for Alice.
        * The Join-Split proof shows (£10 + £5) = (£12 + £3) without revealing these numbers publicly.

7.  **Pairings (Bilinear Maps `e`):**
    * **Definition:** A special mathematical function `e: G1 x G2 -> GT` that takes two points from two different elliptic curve groups (G1, G2) and maps them to a point in a third group (GT).
    * **Key Property:** `e(a*P, b*Q) = e(P, Q)^(a*b)` for scalars `a, b` and points `P, Q`. This allows for checking multiplicative relationships between exponents.
    * **Use in 2018 Aztec:** Crucial for the range proof verification (`e(γ, t_2) = e(σ, g_2)`) and for the efficiency of batched proof verification. Ethereum's precompiles for `alt_bn128` (BN254) curve pairings made this feasible on-chain.

8.  **q-Strong Diffie-Hellman (q-SDH) Assumption:**
    * **Definition:** A cryptographic assumption stating that a particular mathematical problem related to discrete logarithms and pairings on elliptic curves is computationally infeasible to solve.
    * **Relevance:** The *binding* property of the 2018 AZTEC commitment scheme (i.e., you can't open a commitment to two different values) relied on the q-SDH assumption holding true. If q-SDH were broken, the confidentiality of the system could be compromised.

9.  **Gas Costs & Efficiency (2018 Context):**
    * The paper mentions ~840,000 gas for a simple 2-input, 2-output join-split transaction.
    * This was significant but demonstrated that on-chain verification of these ZK proofs was within the realm of possibility on Ethereum, especially with optimized precompiles for elliptic curve operations.
    * The paper also discusses optimizations for batching proofs to reduce per-proof pairing costs.

**TL;DR of the 2018 Whitepaper:**
The original AZTEC protocol introduced a novel way to achieve confidential transactions (hiding amounts) for any asset on Ethereum. It used a UTXO-like "note" system, where notes were encrypted commitments. The core innovation was an efficient ZK range proof integrated with the commitment, verified using elliptic curve pairings. This allowed for "join-split" transactions that conserved value privately. The system required a trusted setup for its parameters. While groundbreaking, it was a stepping stone towards the more programmable and versatile privacy network Aztec aims to be today. 