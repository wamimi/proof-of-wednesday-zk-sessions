# Note Discovery in Aztec

Note discovery is the process by which a user identifies and decrypts the encrypted notes that belong to them from the vast amount of encrypted data on the network.

## Existing Solutions & Challenges

1.  **Brute force / Trial-decrypt**:
    *   **How it works**: The user downloads all possible notes from the network and tries to decrypt each one with their keys. If decryption succeeds, the note belongs to them.
    *   **Drawbacks**: Becomes exponentially expensive as the network grows. Can introduce reliance on a third-party server for gathering and trial-decrypting notes, adding a point of failure.
    *   *Status for Aztec*: Not currently the implemented primary method for Aztec.

2.  **Off-chain Communication**:
    *   **How it works**: The sender of a note directly gives the note content to the recipient through a private, off-chain channel (e.g., secure message).
    *   **Advantages**: Solves the brute-force issue, can lead to lower transaction costs as less data (like detailed logs for discovery) might need to be posted on-chain.
    *   **Drawbacks**: Relies on side channels, which might not be desirable for a fully self-sufficient network interaction.
    *   *Status for Aztec*: Aztec applications **can choose** to use this method if they wish.

## Aztec's Solution: Note Tagging

Aztec introduces an on-chain approach that allows users to efficiently identify which notes are relevant to them by having the sender **tag** the encrypted log in which the note is created. The tag is generated so that (ideally) only the sender and recipient can identify and compute it.

### How Note Tagging Works

1.  **Every Log Has a Tag**:
    *   In Aztec, each emitted encrypted log (which contains the note data) is an array of fields, e.g., `[tag, encrypted_field1, encrypted_field2, ...] M`.
    *   The first field is the **tag field**, used to index and identify logs.
    *   Aztec nodes expose an API (e.g., `getLogsByTags()`) that allows clients (like a user's PXE) to retrieve logs matching specific tags they are interested in.

2.  **Tag Generation**:
    *   The sender and recipient must agree on a predictable scheme for generating tags.
    *   The tag is typically derived from a **shared secret** between the sender and recipient, and often an **index** (a shared counter that increments each time the sender creates a note for that specific recipient).
    *   `tag = H(shared_secret, index)` (Simplified representation)

3.  **Discovering Notes in Aztec Contracts**:
    *   This note discovery scheme (using tags) is intended to be implemented by **Aztec contracts (Aztec.nr)** rather than being solely a PXE-level function.
    *   This gives developers flexibility: users can potentially update their discovery methods or use different types of note discovery mechanisms tailored to their application's needs.

### Limitations of Tagging

*   **Unknown Senders**: You generally cannot receive notes from a completely unknown sender if their address is required to compute the shared secret for tag generation. Workarounds might exist (e.g., senders registering in a public list within a contract, and recipients scanning tags derived from those known senders), but they add complexity.
*   **Index Synchronization**: This is a critical challenge.
    *   If transactions are reverted or mined out of order, the recipient's expected `index` might get out of sync with the sender's actual `index` used for a tag.
    *   If a recipient stops searching after receiving a tag with the latest index they expect, they might miss notes that belong to them but were tagged with an earlier (due to reordering) or later (if their expected index was wrong) index.
    *   Re-using the same index for a reverted and then re-attempted transaction is problematic, as the tag would be the same, potentially linking notes and leaking privacy.
    *   **Mitigation Strategies**:
        *   Widening the search window for tags (e.g., checking a range of possible indices around the expected one). This can't be too wide, or it approaches brute-force.
        *   Implementing restrictions on sending notes (e.g., a user might not be able to send a very large number of notes from the same contract to the same recipient within a very short time frame, to limit index desync issues).

## Further Reading
*   The specifics of how partial notes (notes whose content isn't fully known yet but are detected via tags) are discovered and handled by the PXE and contracts is an area of ongoing development and refinement in the Aztec ecosystem. 