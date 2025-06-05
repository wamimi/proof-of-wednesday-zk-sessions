# Storage Slots in Aztec

Understanding how data is organized and accessed at a low level is crucial. While high-level abstractions simplify development, knowing about storage slots helps in comprehending the underlying mechanics of both public and private state.

## Public State Slots

As mentioned in the [State Model](./StateModel.md), Aztec public state behaves similarly to public state on Ethereum from a developer's perspective. However, the underlying storage management differs.

*   **Single Sparse Tree**: Aztec uses one large sparse Merkle tree for all public state.
*   **Siloing Slots**: To differentiate data belonging to different contracts and different storage variables within those contracts, storage slots are **siloed**. This is done by hashing the `logical_storage_slot` (the slot number you'd think of in your contract code) with the `contract_address`.
    *   `real_storage_slot = H(contract_address, logical_storage_slot)`
*   **Mental Model**: Think of a key-value store where the `real_storage_slot` (the siloed slot) is the key, and the value is the data stored. The `real_storage_slot` identifies its position in the global tree, while the `logical_storage_slot` identifies its position within the contract's conceptual storage layout.
*   **Kernel Circuit Responsibility**: This siloing `(contract_address, logical_storage_slot) -> real_storage_slot` is performed by the Kernel circuits, ensuring data integrity and separation.
*   **Structs and Arrays**: For complex types like structs and arrays, Aztec logically uses a storage slot computation similar to Ethereum (e.g., a struct with 3 fields would conceptually occupy 3 consecutive logical slots). However, because the `real_storage_slot` is a hash, these actual storage positions in the tree will not be consecutive.

## Private State Slots

Private storage is fundamentally different due to privacy requirements.

*   **Append-Only Note Hash Tree**: Private state is stored as encrypted logs (notes), with their commitments residing in an append-only Merkle tree (the note hash tree). Leaves are never updated or deleted directly; instead, a nullifier is emitted to invalidate a note.
*   **No Traditional "Slots"**: Directly updating a value at a fixed "storage slot" would leak information (e.g., that *something* at that slot changed), even if the value itself is encrypted. This is why the concept of a fixed, updatable private storage slot doesn't exist in the same way as public state.
*   **Leaves as Content Commitments**: Leaves in the note hash tree are commitments to the content of the notes (essentially a hash of their content).

### Logical Linking via Storage Slots in Notes

Despite the absence of fixed updatable slots, the *concept* of a storage slot is very useful for application logic (e.g., associating a balance with a user, or a total supply with a token).

*   **Implementation**: To logically link notes that represent a single piece of data (like a user's balance), the `logical_storage_slot` can be included as part of the note data itself.
    *   A user's balance can then be conceptualized as the sum of all valid (non-nullified) notes that share the same `logical_storage_slot` and belong to that user.
*   **Note Hash Siloing (Application Level)**: To make this work, the hash of the note (its commitment) incorporates the `logical_storage_slot`:
    *   `note_hash = H([...packed_note_fields, logical_storage_slot]);`
    *   This is typically handled within the application circuit (the contract's ZK-SNARK logic).
*   **`PrivateSet` and `PrivateMutable` in Aztec.nr**: The `Aztec.nr` library provides wrappers like `PrivateSet` and `PrivateMutable`. These abstractions automatically include the `logical_storage_slot` in the commitments they compute, simplifying this for developers.
*   **Constraining Reads**: When an application circuit reads these notes, it can constrain itself to only consider notes with a specific `logical_storage_slot`.

### Address Siloing (Kernel Level)

To ensure that contracts can only modify their own logical storage and that their notes are unique, a second layer of siloing occurs at the kernel level:

*   **Siloed Note Hash**: The `note_hash` (which already includes the `logical_storage_slot`) is further hashed with the `contract_address` before being inserted into the global note hash tree.
    *   `siloed_note_hash = H(contract_address, note_hash);`
*   **Kernel Enforcement**: This address-siloing is enforced by the kernel circuits. This forces inserted note commitments to correctly attribute themselves to the `contract_address`.
*   **Nullifier Security**: This kernel-level contract siloing is also applied to nullifiers to prevent collisions across different contracts.

For further examples, refer to the developer documentation on storage in Aztec. 