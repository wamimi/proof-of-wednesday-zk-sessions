# 4. Full-Stack Aztec dApp Tutorial

Welcome to the capstone project for Session 3! In this tutorial, we will bring together everything we've learned to build, deploy, and interact with a full-stack Aztec dApp.

**Goal:** Create a hybrid Token contract (with both private and public state), interact with it from a Node.js application using `aztec.js`, and write automated tests with Jest.

This tutorial is divided into three main parts:
1.  **Contract Deployment:** Writing and setting up the Noir smart contract.
2.  **Contract Interaction:** Using `aztec.js` to call our contract's functions.
3.  **Application Testing:** Ensuring our dApp works correctly with Jest.

---

## Part 1: Contract Deployment (Noir)

### Step 1: Initialize the Noir Project

First, create a directory for the Noir contract and initialize a new Aztec project.

```bash
# From the root of the full-stack-dapp-tutorial/ directory
mkdir -p contracts/token
cd contracts/token
aztec-nargo new --contract .
```
*Note: Using `.` creates the project in the current directory.*

### Step 2: Configure Dependencies (`Nargo.toml`)

Open `Nargo.toml` and add the necessary dependencies for our advanced token contract.

```toml
[package]
name = "token"
authors = [""]
compiler_version = ">=0.23.0"
type = "contract"

[dependencies]
aztec = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/aztec" }
authwit = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/authwit"}
uint_note = { git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/uint-note" }
compressed_string = {git="https://github.com/AztecProtocol/aztec-packages/", tag="v0.87.4", directory="noir-projects/aztec-nr/compressed-string"}
```

### Step 3: Write the Contract Code

Our `Token` contract will have several custom types for handling strings and balances. Create the following files and directories:

-   `src/types/balance_set.nr`
-   `src/types/name.nr`
-   `src/types/symbol.nr`
-   `src/main.nr`

Populate these files with the complete source code provided in their respective directories within this tutorial. They define the logic for a hybrid token with private balances, public supply, minting controls, and transfer capabilities.

### Step 4: Compile the Contract

From within the `contracts/token` directory, compile your Noir code.

```bash
aztec-nargo compile
```

This creates the contract artifact at `target/token-Token.json`, which our TypeScript app will need.

---

## Part 2: Contract Interaction (TypeScript)

### Step 1: Set Up the Node.js Project

Navigate back to the root of the `full-stack-dapp-tutorial` directory.

-   Create the `package.json`, `tsconfig.json`, and `.yarnrc.yml` files as provided in this tutorial.
-   Install dependencies: `yarn install`

### Step 2: Write the Deployment Script

Before we can interact with our contract, we need to deploy it. Create a script for this at `src/deployment.mjs`.

**`src/deployment.mjs`**
```javascript
import { createPXEClient, waitForPXE, Deployer, Fr } from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { TokenContract } from '@aztec/noir-contracts.js/Token';
import { writeFileSync } from 'fs';

const { PXE_URL = 'http://localhost:8080' } = process.env;

async function main() {
  const pxe = createPXEClient(PXE_URL);
  await waitForPXE(pxe);
  const [owner] = await getInitialTestAccountsWallets(pxe);
  
  console.log('Deploying Token contract...');
  const contract = await TokenContract.deploy(owner, owner.getAddress(), 'TestToken', 'TST', 18).send().deployed();
  
  console.log(`Token contract deployed at ${contract.address.toString()}`);
  
  // Save the address for other scripts
  writeFileSync('addresses.json', JSON.stringify({ token: contract.address.toString() }));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
```

Run the deployment script:
```bash
node src/deployment.mjs
```
This will deploy the contract and create an `addresses.json` file.

### Step 3: Write the Interaction Script

Now create the `src/index.mjs` and `src/contracts.mjs` files as provided in this tutorial. `index.mjs` contains the logic to connect to the PXE and call the various mint and transfer functions, demonstrating the dApp's capabilities.

Run the interaction script:
```bash
node src/index.mjs
```
You will see the balances printed before and after each private mint, public mint, and private transfer, showing the hybrid state model in action.

---

## Part 3: Testing Your Application (Jest)

### Step 1: Write the Test File

Create the `src/index.test.mjs` file as provided in this tutorial. This Jest test will:
1.  Run a `beforeAll` hook to deploy a fresh, isolated `TokenContract` instance for testing.
2.  Mint an initial private balance to an `owner` account.
3.  Run a test case (`it` block) that transfers tokens to a `recipient` and asserts that the recipient's balance correctly increases.

### Step 2: Run the Tests

Execute the tests using the command specified in `package.json`:

```bash
yarn test
```

You will see Jest's output confirming that the test setup completed and the transfer test passed successfully.

## Conclusion

Congratulations! You have successfully built a complete full-stack dApp on Aztec, from writing a complex hybrid-state Noir contract to interacting with it via TypeScript and verifying its functionality with automated tests. You now have a solid foundation to build the next generation of private, scalable applications. 