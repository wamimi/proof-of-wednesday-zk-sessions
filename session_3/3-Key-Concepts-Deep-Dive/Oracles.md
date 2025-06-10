# Key Concept: Oracles (in Aztec)

In the broader blockchain world, an "oracle" is typically a service that brings external, real-world data (like the price of BTC/USD) onto the public blockchain. In Aztec, the term **Oracle Call** refers to something more specific and fundamental to how private execution works: it's a mechanism for a private function, during proof generation, to request information from the user's local Private Execution Environment (PXE).

**Analogy: Consulting Your Notes During an Exam**

Imagine you are taking a very difficult, closed-book exam (`#[private]` function execution). The exam room is isolated and secure (the ZK-proof environment). However, the exam proctor (the Aztec protocol) allows you a special privilege: at certain points, you can raise your hand and ask your personal tutor (the **PXE**), who is waiting right outside the door, for a specific piece of information from your private notebook.

-   You can't ask for the final answer.
-   You can only ask for specific data points you need to solve the problem.
-   The proctor doesn't see the information on your notes; they only see you asking the question and receiving an answer. The information goes directly into your exam paper (the witness for the ZK-proof).

This is exactly what an oracle call is in Aztec. It's a secure communication channel between a private circuit being proved and the user's wallet, which holds all the secret information.

## How Do Oracle Calls Work?

When the Noir compiler encounters an oracle call function inside a `#[private]` function, it embeds a special instruction into the circuit. When the PXE executes this circuit to generate a proof, it sees this instruction and pauses the execution. It then provides the requested information, and the circuit execution resumes with this new information included as a private input.

## Examples from Our Tutorials

We have already seen two major examples of oracle calls:

1.  **`context.request_nsk_app(...)`** (from the Private Voting contract)
    -   **The Question:** "Hey PXE, I need the secret Nullifier Spending Key (NSK) that is associated with this application and this user. I need it to generate a unique nullifier so this user can't vote twice."
    -   **The Answer:** The PXE provides the secret key, which is used inside the `cast_vote` function to create the nullifier.

2.  **`get_auth_witness(&mut context, payload.hash())`** (from the Account Abstraction contract)
    -   **The Question:** "Hey PXE, I need an authentication witness. Please take this transaction payload hash, sign it with the user's authentication private key, and give me the resulting signature."
    -   **The Answer:** The PXE (via the `AuthWitnessProvider`) provides the Schnorr signature, which is then used inside the `is_valid_impl` function to verify the transaction's authenticity.

Another common example is fetching private notes: when you want to make a transfer, an oracle call is used to ask the PXE, "Which of my private notes can I use to cover this amount?" The PXE provides the necessary notes to be consumed in the transaction.

## Why are Oracles Necessary for Privacy?

Oracles are the bridge that makes private dApps practical. Private functions need access to secrets to do their work—secrets that cannot be passed in as public function arguments or stored in public state. Oracle calls provide a secure and standardized way for a circuit to say, "I have reached a point where I need secret information X," allowing the user's own machine to privately inject that secret into the proof, keeping it shielded from the public network. 