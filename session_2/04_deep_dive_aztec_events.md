# Deep Dive: Aztec's Event System (Logs)

A common question from developers familiar with Solidity is whether Aztec has an equivalent to `events`. The answer is yes, and Aztec's implementation is arguably even more powerful, as it integrates directly with the network's privacy features.

In Aztec, events are referred to as **logs**. They allow smart contracts to communicate information about their execution to the outside world. Crucially, Aztec supports both **public (unencrypted) logs** and **private (encrypted) logs**.

This capability is documented in the official Aztec documentation. The primary source for this information can be found on the **[Testing Aztec.nr contracts with TypeScript](https://docs.aztec.network/developers/guides/js_apps/test#logs)** page, which states:

> "You can check the logs of events emitted by contracts. Contracts in Aztec can emit both encrypted and unencrypted events."

A practical example of querying these logs is also available in the **[Contract Interaction Tutorial](https://docs.aztec.network/developers/tutorials/codealong/js_tutorials/simple_dapp/contract_interaction)**.

---

## How Events Work in Aztec

Let's break down how to define and use events in an Aztec contract, using examples from the `Token.nr` contract created in Session 3.

### 1. Defining Events in Noir

Events are defined as `structs` within your Noir contract. You can define as many as your application requires.

For example, in the full-stack dApp, we defined a `Transfer` event to log the details of a token transfer.

```rust
// From: session_3/aztec_app_token/contracts/token_contract/src/main.nr

// ... existing code ...

struct Transfer {
    from: AztecAddress,
    to: AztecAddress,
    amount: Field,
}

// ... existing code ...
```

### 2. Emitting Events

You emit events from within your contract's functions using the `emit_unencrypted_log` function, which is available in the `context`.

The `context` is passed as the first argument to any external function. The event struct is then passed to the logging function.

```rust
// From: session_3/aztec_app_token/contracts/token_contract/src/main.nr

// ... existing code ...

    unconstrained fn transfer(
        context: &mut PrivateContext,
        from: AztecAddress,
        to: AztecAddress,
        amount: Field,
        nonce: Field,
    ) -> pub fn(Context) -> bool {
        // ... function logic ...

        let event = Transfer { from, to, amount };
        context.emit_unencrypted_log(&event);

        // ... rest of function ...
    }

// ... existing code ...
```

### 3. Querying Logs with Aztec.js

Once a transaction is mined, you can query the logs it produced from your client-side TypeScript/JavaScript application using the PXE (Private Execution Environment).

The `getPublicLogs` method allows you to filter logs, for instance, by the block number in which your transaction was included.

```typescript
// From: session_3/aztec_app_token/src/scripts/index.ts

// ... existing code ...

  console.log("⏳ Waiting for transaction to be mined...");
  const receipt = await tx.wait();

  // We can retrieve the logs emitted by our contract
  if (receipt.status === "mined") {
    console.log("✅ Transaction mined!");
    const logs = (await pxe.getPublicLogs({ fromBlock: receipt.blockNumber! })).logs;
    const transferLog = logs.find(log => {
      try {
        // We need to decode the log from our event struct
        return Transfer.fromBuffer(log.log.data).amount === amount;
      } catch (e) {
        return false;
      }
    });

    if (transferLog) {
      const decodedLog = Transfer.fromBuffer(transferLog.log.data);
      console.log(
        `🎉 Transfer Log Found: From ${decodedLog.from.toString()} to ${decodedLog.to.toString()} for ${decodedLog.amount} tokens`
      );
    }
  }
// ... existing code ...
```

This example demonstrates the end-to-end flow: defining an event, emitting it during a transaction, and then decoding and verifying it on the client. This powerful logging mechanism is essential for building transparent, auditable, and interactive dApps on Aztec. 