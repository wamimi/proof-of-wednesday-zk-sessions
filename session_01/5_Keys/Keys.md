# Cryptographic Keys in Aztec

In Aztec, each account is associated with several cryptographic key pairs. These keys are fundamental to the network's privacy, security, and functionality, enabling everything from spending notes to encrypting data and deriving account addresses.

## Types of Keys

Each Aztec account is primarily backed by four types of key pairs. The first three (Nullifier, Address, Incoming Viewing) are deeply embedded into the protocol, while Signing Keys are abstracted to the account contract developer.

### 1. Nullifier Keys
*   **Pair**: Master Nullifier Public Key (`Npk_m`) and Master Nullifier Secret Key (`nsk_m`).
*   **Purpose**: Used to spend/consume private [notes](./../NotesAndUTXOs/Notes.md). When a note is spent, its nullifier is revealed, preventing it from being spent again.
*   **How it works**: To spend a note, the user computes a unique nullifier. This nullifier is typically a hash of the note's commitment (or the note hash itself) and an **app-siloed nullifier secret key**. This app-siloed key is derived using the user's master nullifier secret key (`nsk_m`) and the specific contract address the note is associated with (`nsk_app = H(nsk_m, app_contract_address)`). The protocol ensures that only someone possessing the `nsk_m` (and thus able to derive `nsk_app`) linked to the note owner's address can generate the correct nullifier.

### 2. Address Keys
*   **Pair**: Address Public Key (`AddressPublicKey`) and Address Secret Key (`address_sk`).
*   **Purpose**: Primarily used for the derivation of the account's unique address. Also plays a role in note encryption.
*   **Derivation Details**:
    *   `AddressPublicKey` is an elliptic curve point `(x,y)` on the Grumpkin curve. The account's human-readable address is typically its `x`-coordinate.
    *   The `address_sk` is derived from a `pre_address` and the `ivsk_m` (master incoming viewing secret key): `address_sk = pre_address + ivsk_m`.
    *   `pre_address` itself is a complex hash ensuring the address is tied to the account's keys and contract logic:
        *   `pre_address := poseidon2(public_keys_hash, partial_address)`
        *   `public_keys_hash := poseidon2(Npk_m, Ivpk_m, Ovpk_m, Tpk_m)` (where `Ovpk_m` is Master Outgoing Viewing Public Key and `Tpk_m` is Master Tagging Public Key - currently less utilized but formally part of the structure).
        *   `partial_address := poseidon2(contract_class_id, salted_initialization_hash)`
        *   `contract_class_id := poseidon2(artifact_hash, fn_tree_root, public_bytecode_commitment)`
        *   `salted_initialization_hash := poseidon2(deployer_address, salt, constructor_hash)`
    *   This intricate derivation means an Aztec address commits to the contract's code, its initialization parameters, and the user's core cryptographic keys.

### 3. Incoming Viewing Keys
*   **Pair**: Master Incoming Viewing Public Key (`Ivpk_m`) and Master Incoming Viewing Secret Key (`ivsk_m`). (Note: The document also mentions `Ovpk_m` - Outgoing Viewing Public Key, which is part of `public_keys_hash` but less emphasized in current primary use cases like note reception).
*   **Purpose**: `Ivpk_m` (via the derived `AddressPublicKey` of the recipient) is used by a sender to encrypt a note *for* the recipient. The recipient uses their `ivsk_m` (via their `address_sk`) to decrypt the note.
*   **Encryption/Decryption Flow (Simplified for a note)**:
    1.  **Sender Side**: To send a note to Recipient:
        *   Sender generates a random ephemeral key pair (`esk_sender`, `Epk_sender`).
        *   Sender uses Recipient's `AddressPublicKey` (which is derived using Recipient's `ivsk_m`) and `esk_sender` to compute a shared secret: `S = esk_sender * AddressPublicKey_recipient`.
        *   A symmetric encryption key is derived from this shared secret: `symmetric_key = hash(S)`.
        *   The note data is encrypted: `Ciphertext = aes_encrypt(note_data, symmetric_key)`.
    2.  **Transmission**: Sender transmits `(Epk_sender, Ciphertext)` to the Recipient (e.g., as an encrypted log on-chain).
    3.  **Recipient Side**: To decrypt:
        *   Recipient uses their `address_sk` (which incorporates their `ivsk_m`) and the received `Epk_sender` to reconstruct the same shared secret: `S = Epk_sender * address_sk_recipient`.
        *   Recipient derives the `symmetric_key` from `S`.
        *   Recipient decrypts the `Ciphertext` using `symmetric_key`.

### 4. Signing Keys (Optional & Abstracted)
*   **Purpose**: Used for authorizing actions, typically by signing messages or transaction payloads within an [Account Contract](./../AccountsAndAuth/Accounts.md). This is the most "traditional" use of keys for authentication.
*   **Abstraction**: Due to Aztec's native Account Abstraction, developers are **not forced** to use a specific signature scheme (like ECDSA or Schnorr) or even keys at all for authorization. Account contracts can implement custom logic (e.g., social recovery, multi-factor authentication, passwords, Face ID hooks).
*   **If Used**: If an account contract uses signature-based authentication, it will manage a signing public key and its entrypoint logic will verify incoming signatures against this stored public key.
    *   Example from Schnorr Account Contract: `schnorr::verify_signature(pub_key, signature, payload_hash.to_be_bytes::<32>())`
*   **Storing Signing Public Keys**: Since these are abstracted, the method of storing the public key within the account contract is up to the developer:
    *   **Private Note**: Allows key rotation. Reading the note (and nullifying it to ensure it's up-to-date) incurs a small overhead per transaction.
    *   **Immutable Private Note**: No per-transaction overhead for reading, but the key cannot be rotated.
    *   **Shared Mutable State (Privately Readable, Publicly Mutable)**: Allows rotation but introduces complexities like update delays and time-to-live for transactions based on state update frequency.
    *   **Reusing In-Protocol Keys (e.g., `Ivpk_m`)**: Possible to validate against the account address (since `Ivpk_m` is part of its preimage). Generally **not recommended** as it reduces key separation and security.
    *   **Separate Keystore Contract**: A dedicated contract acts as a keystore, and multiple account contracts can check against it for authorization. Incurs higher proving time per transaction but no extra fee cost.

## Key Generation
*   Nullifier, Address, and Incoming Viewing keys (and their master versions) are typically generated by the user's [PXE](./../ExecutionEnvironment/PXE.md) when an account is created.
*   The PXE is also responsible for further key management, including oracle access to keys for circuit execution and deriving app-siloed keys.

## Key Derivation Cryptography
*   Most key pairs (secret key, public key) are derived using elliptic curve cryptography on the **Grumpkin curve**. The secret key is a scalar, and the public key is that scalar multiplied by the curve's generator point `G`.
*   The `address_sk` is an exception, derived as described in the Address Keys section.

## App-Siloed Keys
*   **Concept**: Nullifier keys and Incoming Viewing keys are **app-siloed**. This means the actual keys used by a user within a specific application contract are not their master keys directly, but rather keys derived from their master keys *and* that specific application contract's address.
    *   Example: `nsk_app_A = hash(nsk_m_user, contract_A_address)`
    *   `ivpk_app_A_recipient = H(ivpk_m_recipient, contract_A_address)` (conceptual)
*   **Derivation**: This derivation happens within the PXE whenever the user interacts with an application.
*   **Benefits**:
    *   **Enhanced Security**: If an app-siloed key is compromised (e.g., due to a vulnerability in one specific app contract), it only affects the user's assets and privacy *within that single application*. Their master keys and their assets in other applications remain secure.
    *   **Per-Application Auditability/Disclosure**: A user can choose to disclose their app-siloed incoming viewing key for a specific application to a third party (e.g., an auditor, regulator, or a block explorer for display purposes). This reveals all their activity *only within that specific application context*, while preserving their privacy across all other applications on the network.

## Key Rotation
*   **Impossible for Protocol-Embedded Keys**: Nullifier Keys, Address Keys, and Incoming Viewing Keys **cannot be rotated**. They are fundamentally embedded into the derivation of the account's address, and the address itself is immutable once determined.
*   **Possible for Signing Keys**: Signing Keys **can be rotated**, provided the account contract is designed to support this (e.g., by storing the signing public key in a mutable private note or a shared mutable state slot).

## Escrow Contracts: A Special Case
*   Typically, account contracts will have non-zero public keys for these core functions. Non-account (application) contracts usually have zero for these specific protocol-level key fields.
*   **Exception**: An escrow contract might be an example of a non-account contract that has its own `Npk_m` registered. Notes intended for the escrow would be encrypted to this `Npk_m`.
*   Participants in the escrow (e.g., parties in a bet) would then need a way to obtain or use the escrow's `nsk_m` (or a derived app-siloed version) to nullify the escrowed notes based on the escrow contract's logic (e.g., providing a "proof of winning").

## Why it Matters for Developers
*   You generally don't handle these keys directly at the DApp layer; the PXE and account contracts abstract much of their management.
*   Understanding app-siloing is crucial for appreciating Aztec's security and privacy model.
*   When designing custom account contracts ([Accounts](./../AccountsAndAuth/Accounts.md)), you have significant choices in how (or if) you implement signing keys, their storage, and their rotation capabilities, directly impacting user security and flexibility. 