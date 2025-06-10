# 2b. Account Abstraction: The TypeScript Interaction

This tutorial covers the second part of our Account Abstraction deep dive: writing the TypeScript "glue code" to deploy and interact with our custom `SchnorrHardcodedAccount` contract.

**Goal:** Use Aztec.js to deploy our custom account contract and then use that new account to deploy and interact with a `Token` contract.

## Prerequisites
- You have completed Part 2a and have the compiled `schnorr_account_contract` artifact.
- You have a running Aztec Sandbox.
- You have Node.js and Yarn (or npm) installed.

## Step 1: Project Setup

Create a new directory for your TypeScript project (`typescript_interaction`) and set up your `package.json` and `tsconfig.json` as detailed in the previous steps.

Install the necessary dependencies:

```bash
yarn add @aztec/aztec.js@0.87.4 @aztec/accounts@0.87.4 @aztec/noir-contracts.js@0.87.4 typescript @types/node
```

## Step 2: The Interaction Script

Create a file named `src/index.ts`. This script will perform all the actions. Below is the complete code, which we'll break down in the `EXPLAINED.md` file.

**`src/index.ts`**
```typescript
import {
  AccountManager,
  AccountWallet,
  AztecAddress,
  CompleteAddress,
  Fr,
  GrumpkinScalar,
  PXE,
  createPXEClient,
  waitForPXE,
  generatePublicKey,
  mustSucceedFetch,
} from "@aztec/aztec.js";
import { AuthWitnessProvider, SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { createLogger } from "@aztec/foundation/log";
import { format } from "util";

// --- CONFIG ---
const { PXE_URL = "http://localhost:8080" } = process.env;
const logger = createLogger("aztec:http-pxe-client");
// --- END CONFIG ---

async function main() {
  // 1. Connect to the Aztec Sandbox (PXE)
  const pxe = createPXEClient(PXE_URL, { fetch: mustSucceedFetch });
  await waitForPXE(pxe, logger);
  logger.info("Connected to PXE.");

  // 2. Load our custom account contract artifact
  // NOTE: This assumes you have compiled the Noir contract from Part 2a
  const accountContractArtifact = new SchnorrAccountContract().artifact;

  // 3. Create a new key set for our custom account
  const privateKey = GrumpkinScalar.random();
  const publicKey = generatePublicKey(privateKey);

  // 4. Create an AccountManager to handle the deployment
  const accountManager = new AccountManager(pxe, privateKey, accountContractArtifact);

  // 5. Deploy the custom account contract
  logger.info("Deploying custom account contract...");
  const wallet = await accountManager.deploy(publicKey).wait();
  logger.info(`Custom account deployed at: ${wallet.getAddress().toString()}`);

  // 6. Use the new account to deploy a Token contract
  logger.info("Deploying Token contract with custom account...");
  const tokenContract = await TokenContract.deploy(
    wallet, // Use our custom wallet!
    wallet.getAddress(),
    "TestToken",
    "TKN",
    18
  ).send().deployed();
  logger.info(`Token contract deployed at: ${tokenContract.address.toString()}`);

  // 7. Interact with the Token contract using the custom account
  const mintAmount = 100n;
  logger.info(`Minting ${mintAmount} tokens...`);
  await tokenContract.methods.mint_to_private(wallet.getAddress(), wallet.getAddress(), mintAmount).send().wait();

  const balance = await tokenContract.methods.balance_of_private(wallet.getAddress()).simulate();
  logger.info(`Private balance of custom account: ${balance}`);
  
  if (balance !== mintAmount) throw new Error("Incorrect balance!");

  logger.info("✅ Successfully used a custom account to deploy and interact with a contract!");
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
```

## Step 3: Run the Script

First, build the TypeScript code:
```bash
yarn build
```

Then, run the compiled JavaScript:
```bash
node dest/index.js
```

## Summary

If the script runs successfully, you have just:
1.  Connected to the Aztec network.
2.  Generated a new private key for a custom account.
3.  Deployed the `SchnorrHardcodedAccount` contract to the network.
4.  Created a `wallet` instance that knows how to sign transactions for this custom account.
5.  **Used your custom account** to deploy a completely separate `Token` contract.
6.  **Used your custom account again** to call the `mint_to_private` function on the `Token` contract.
7.  Queried the result to confirm the interaction was successful.

This demonstrates the end-to-end power of Account Abstraction in Aztec. You are no longer just a user; you are the architect of your own account's security model. 