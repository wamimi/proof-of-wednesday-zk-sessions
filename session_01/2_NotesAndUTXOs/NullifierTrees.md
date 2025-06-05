# Nullifier Trees: Efficiently Preventing Double Spends

In systems with private state, like Aztec, preventing an asset (a "note" or UTXO) from being spent more than once is critical. This is achieved using **nullifiers**. When a note is spent, a unique nullifier corresponding to that note is published. The system must then check that this nullifier hasn't been seen before.

This page explores how Aztec aims to manage these nullifiers efficiently using a structure based on Indexed Merkle Trees.

## Primer on Nullifier Trees

*   **Why needed?**: In a UTXO model, state is stored in encrypted notes. To maintain privacy, you don't "update" a note; you "destroy" (nullify) the old one and create new ones.
*   **Append-Only Note Trees**: The tree storing the notes themselves is append-only.
*   **Nullifier Tree's Role**: A separate data structure, the nullifier tree, is used to record which notes have been spent. When attempting to spend a note, a user must prove that its corresponding nullifier *does not already exist* in the nullifier tree.

### Traditional Sparse Merkle Trees for Nullifiers

*   **Concept**: A sparse Merkle tree could theoretically store nullifiers. Each possible nullifier value maps to a leaf index. If `tree_values[nullifier_value] == 0`, it's not spent; if `1`, it is.
    ```mermaid
    graph TD
        R((Root))
        R --> H1
        R --> H2
        H1 --> L1["Leaf 0 (value)"]
        H1 --> L2["Leaf 1 (0)"]
        H2 --> L3["Leaf ... (0)"]
        H2 --> L4["Leaf 2^n-1 (value)"]
        subgraph Sparse Merkle Tree Example
            direction LR
            L1
            L2
            L3
            L4
        end
    ```
*   **Problem**: For a large nullifier space (e.g., 254-bit field elements), the tree would be extremely deep (254 levels). Each non-membership proof and subsequent insertion requires hashing up the tree (e.g., 254 hashes for non-membership, 254 for insertion). This is too computationally expensive for rollup circuits, where these checks occur.

## Indexed Merkle Trees: A More Efficient Approach

Introduced in [this paper (page 6)](https://eprint.iacr.org/2019/1255.pdf), Indexed Merkle Trees offer efficient non-membership proofs by changing how data is stored and linked.

*   **Structure**: Instead of placing leaves at `index == value`, leaves are appended, and each node stores not just its value `v` but also pointers (`next_index`, `next_value`) to the leaf with the *next highest value* in the tree. The tree essentially maintains a sorted linked list of nullifiers.
    *   Leaf structure: `{ value: Field, next_index: Field, next_value: Field }`
*   **Assumption**: If a leaf has `value = v1` and `next_value = v2`, there are no other leaves in the tree with a value strictly between `v1` and `v2`.
*   **Benefit**: The tree doesn't need to be as deep as a sparse Merkle tree (e.g., depth 32 might suffice), significantly reducing hash operations (e.g., from ~250 to ~30 per operation).

### Visualizing Insertions (Conceptual Linked List)

Let `(v, ni, nv)` denote `(value, next_index, next_value)`. `idx_X` is the tree index of the leaf for value X.
We assume a `0` node is pre-populated, pointing to the largest possible value or `0` if the tree is empty/`value` is the current max.

1.  **Initial State (conceptual, tree has a 0-node placeholder):**
    ```mermaid
    graph LR
        N0["Leaf at idx_0: (0, 0, 0)"] -- next_value points to 0 (empty or end) --> N0;
    ```

2.  **Add New Value `v=30` (inserted at `new_idx_30`):**
    *   Low nullifier is Leaf 0.
    *   Update Leaf 0: `(0, new_idx_30, 30)`
    *   New Leaf 30: `(30, 0, 0)` (points to end)
    ```mermaid
    graph LR
        N0["Leaf at idx_0: (0, new_idx_30, 30)"] --> N30["Leaf at new_idx_30: (30, 0, 0)"];
        N30 -- next_value points to 0 --> N0;
    ```

3.  **Add New Value `v=10` (inserted at `new_idx_10`):**
    *   Low nullifier is Leaf 0.
    *   Update Leaf 0: `(0, new_idx_10, 10)`
    *   New Leaf 10: `(10, new_idx_30, 30)` (original `next_value` of Leaf 0)
    ```mermaid
    graph LR
        N0["Leaf at idx_0: (0, new_idx_10, 10)"] --> N10["Leaf at new_idx_10: (10, new_idx_30, 30)"];
        N10 --> N30["Leaf at new_idx_30: (30, 0, 0)"];
        N30 -- next_value points to 0 --> N0;
    ```

4.  **Add New Value `v=20` (inserted at `new_idx_20`):**
    *   Low nullifier is Leaf 10.
    *   Update Leaf 10: `(10, new_idx_20, 20)`
    *   New Leaf 20: `(20, new_idx_30, 30)` (original `next_value` of Leaf 10)
    ```mermaid
    graph LR
        N0["Leaf at idx_0: (0, new_idx_10, 10)"] --> N10["Leaf at new_idx_10: (10, new_idx_20, 20)"];
        N10 --> N20["Leaf at new_idx_20: (20, new_idx_30, 30)"];
        N20 --> N30["Leaf at new_idx_30: (30, 0, 0)"];
        N30 -- next_value points to 0 --> N0;
    ```

(The actual tree structure is a Merkle tree; the above shows the logical linked list via pointers.)

### Insertion Protocol (Simplified)

1.  **Find Low Nullifier**: Find an existing leaf (`low_nullifier_leaf`) in the tree such that `low_nullifier_leaf.value < new_nullifier` and `low_nullifier_leaf.next_value > new_nullifier` (or `low_nullifier_leaf.next_value == 0` if `new_nullifier` is the largest so far).
2.  **Membership Check**: Prove `low_nullifier_leaf` exists in the tree (Merkle proof).
3.  **Range Check**: Verify that `new_nullifier` indeed falls between `low_nullifier_leaf.value` and `low_nullifier_leaf.next_value`.
4.  **Update Low Nullifier's Pointers**: Modify `low_nullifier_leaf` so its `next_index` points to the index where `new_nullifier` will be inserted, and its `next_value` becomes `new_nullifier`.
5.  **Insert Updated Low Nullifier**: Insert this modified `low_nullifier_leaf` back into the Merkle tree (this yields a new Merkle root).
6.  **Create New Leaf**: Prepare the leaf for `new_nullifier`. Its `value` is `new_nullifier`. Its `next_index` and `next_value` are taken from the *original* `low_nullifier_leaf`'s `next_index` and `next_value` (before it was updated in step 4).
7.  **Insert New Leaf**: Insert this new leaf for `new_nullifier` into an empty slot in the Merkle tree (yields the final new Merkle root).

This involves roughly 3 Merkle path hashes (1 read, 2 updates/insertions of depth ~32) plus some equality and range checks, far fewer than the 2 * 254 hashes of a deep sparse tree.

### Non-Membership Proof

To prove `value_x` does *not* exist:
1.  Reveal the `low_nullifier_leaf` such that `low_nullifier_leaf.value < value_x` and `low_nullifier_leaf.next_value > value_x` (or `next_value == 0` if `value_x` would be largest).
2.  Prove `low_nullifier_leaf` is in the tree (Merkle proof, `n` hashes where `n` is tree depth).
3.  Perform range checks to show `value_x` falls strictly between `low_nullifier_leaf.value` and `low_nullifier_leaf.next_value`.

### Batch Insertions

Since nullifiers are often inserted in batches within a rollup, further optimizations are possible.

*   **Append-Only Nature**: New nullifiers are appended to the tree structure.
*   **Subtree Insertion**: Instead of inserting nodes one by one, an entire subtree of new nullifiers can be calculated and then inserted into the main tree.
    1.  Prove the target location in the main tree (where the new subtree will attach) is currently empty.
    2.  Construct the new subtree with new nullifiers and their updated pointers locally.
    3.  Use the sibling path from step 1 to calculate the new root of the main tree after attaching the new subtree root.
*   **Complexity with Pointers**: When batching, a `low_nullifier_leaf` for a new nullifier might itself be *within the batch being inserted* (a "pending" insertion). The circuit logic must handle these cases by checking pending values before looking at the main tree state.

**Performance Gains**: Batching significantly reduces per-nullifier hashing costs compared to individual insertions.

### Circuit Logic for Batch/Pending Insertions (Conceptual Pseudocode)

```
// Inputs: new_nullifiers[], low_leaf_preimages[], low_leaf_witnesses[], current_root, next_insertion_idx, subtree_path

empty_subtree_hash = CONSTANT_EMPTY_SUBTREE_HASH;
pending_insertion_subtree = [];
insertion_idx = inputs.next_insertion_index;
root = inputs.current_nullifier_tree_root;

// 1. Check if the slot for the new subtree is empty in the current tree
assert(membership_check(root, empty_subtree_hash, insertion_idx >> subtree_depth, inputs.subtree_insertion_sibling_path));

for (i in 0..len(new_nullifiers)) {
    current_new_nullifier = inputs.new_nullifiers[i];
    low_leaf = inputs.low_nullifier_leaf_preimages[i];
    low_witness = inputs.low_nullifier_membership_witnesses[i];
    found_low_in_pending = false;

    // 2. Is the low_nullifier_leaf for current_new_nullifier in the pending batch?
    if (low_witness is marked_as_pending_lookup) { // e.g., witness is null or index is special
        for (j in 0..i) { // Search already processed items in this batch
            pending_leaf = pending_insertion_subtree[j];
            if (pending_leaf.value < current_new_nullifier && 
                (pending_leaf.next_value > current_new_nullifier || pending_leaf.next_value == 0)) {
                // Found low_nullifier in pending batch. Update its pointers.
                // Original next pointers of pending_leaf go to current_new_nullifier's leaf.
                // pending_leaf now points to current_new_nullifier.
                // ... (update logic for pending_leaf and setup for current_new_nullifier_leaf) ...
                pending_insertion_subtree.push(new_leaf_for_current_nullifier);
                found_low_in_pending = true;
                break;
            }
        }
        assert(found_low_in_pending); // Must be found if marked as pending
    } else {
        // 3. Low_nullifier is in the main tree. Standard verification.
        assert(perform_membership_check(root, hash(low_leaf), low_witness)); // Check low_leaf is in current tree root
        // Range checks for current_new_nullifier against low_leaf
        assert(current_new_nullifier > low_leaf.value);
        assert(current_new_nullifier < low_leaf.next_value || low_leaf.next_value == 0);

        // Prepare new_leaf_for_current_nullifier (value = current_new_nullifier, next pointers from low_leaf.next)
        // Update low_leaf's next pointers to point to current_new_nullifier (at future insertion_idx)
        
        // Update the main tree root by re-inserting the modified low_leaf
        root = update_leaf_in_tree(root, low_leaf_modified, low_witness);
        pending_insertion_subtree.push(new_leaf_for_current_nullifier);
    }
    insertion_idx++; // For the next nullifier in the batch
}

// 4. Insert the entire pending_insertion_subtree into the main tree structure
root = insert_subtree_into_main_tree(root, inputs.next_insertion_index >> subtree_depth, pending_insertion_subtree, inputs.subtree_insertion_sibling_path);

// return final root
```

### Drawbacks

*   **Node Computation/Storage**: While in-circuit costs are lower, the node (off-chain component) needs to do more work to find the correct `low_nullifier_leaf` for any new nullifier. This might involve searching or maintaining a sorted data structure of existing nullifiers, increasing node storage/CPU requirements.

### Conclusion

Indexed Merkle Trees, especially with batching, offer significant performance improvements for nullifier checks within ZK circuits compared to traditional sparse Merkle trees. This is crucial for the efficiency of rollup systems like Aztec that rely on private state and nullification. 