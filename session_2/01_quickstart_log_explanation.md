# Session 2: Aztec Smart Contracts, Deployment & Logs

Welcome to Session 2! The goal of this session is to move from theory to practice. We will be following along with the Aztec tutorials to write, compile, deploy, and interact with our first Aztec smart contracts. We'll deploy to both the local sandbox and eventually a shared testnet.

This document will act as our guide and a reference for what we accomplish. First, let's demystify what happened in the terminal during the Quickstart.

## Understanding the Quickstart Logs

When you run commands using `aztec-wallet`, a lot happens behind the scenes. It's not magic! It's a sequence of well-defined steps involving your wallet, a **Private Execution Environment (PXE)**, and the local Aztec Sandbox. Let's break down the logs you saw, step-by-step.

### 1. Importing Test Accounts

This is the first command you ran to get access to the pre-funded accounts in the sandbox.

**Command:**
```bash
aztec-wallet import-test-accounts
```

**Log Deep Dive:**
```log
[13:18:42.404] INFO: wallet Using local PXE service
[13:18:42.917] INFO: pxe:data:lmdb Creating pxe_data data store at directory /home/segfaultnojutsu/.aztec/wallet/pxe/pxe_data...
[13:18:43.328] INFO: pxe:service Started PXE connected to chain 31337 version 2532246222
[13:18:44.267] INFO: pxe:service Added contract SchnorrAccount at 0x1165...
[13:18:44.594] INFO: pxe:service Registered account 0x1165...
Account stored in database with aliases last & test0
```
*   **`Using local PXE service`**: Your `aztec-wallet` acts as a client. It connects to the Private Execution Environment (PXE), which you can think of as a secure local service that manages your accounts, keys, and private state. It's the component that builds and proves your private transactions.
*   **`Creating pxe_data data store`**: The PXE and wallet need a database to store information. This log shows it's setting up a local LMDB database at `~/.aztec/wallet/pxe/pxe_data`. This is where your encrypted notes, account keys, and known contract addresses will be stored.
*   **`Started PXE connected to chain 31337`**: Your PXE is now connected to the underlying blockchain. In this case, it's the local Anvil node (which uses Chain ID 31337) that comes with the sandbox.
*   **`Added contract SchnorrAccount`**: The PXE is being told about the smart contract for the test account. Aztec accounts are smart contracts themselves. These default accounts use `SchnorrAccount` logic, which uses Schnorr signatures for authorizing transactions.
*   **`Registered account`**: This is a crucial step. The PXE is now storing the full account details, including the private and public keys. It needs these keys to decrypt incoming notes for you and to sign/prove transactions you want to send.
*   **`Account stored in database with aliases...`**: Finally, for your convenience, the wallet saves a reference to this account with a simple name: `test0`.

### 2. Creating a New Account

Next, you created your very own account. This is where we see the magic of client-side proving for the first time.

**Command:**
```bash
aztec-wallet create-account -a my-wallet --payment method=fee_juice,feePayer=test0
```

**Log Deep Dive:**
```log
New account:
Address:         0x25f23273dab9d8683e6e9dfd2f7e301fb6c493583ae39e592486816171ef628a
Public key:      0x2337f5b196c6f4140b93e008b5821dc5c1ab75bee6f90fa576dda645235c5ab2...
Secret key:     0x1a95fc08e8319d2a6b4437384db83b2d87e15e9baba0d6282aec5c7b5974317e
...
Using Fee Juice for fee payment
[13:19:14.333] INFO: pxe:service Started PXE connected to chain 31337 version 2532246222
...
[13:19:29.070] INFO: pxe:private-kernel-execution-prover Private kernel witness generation took 4092.1016139999992ms
[13:19:29.071] INFO: pxe:bb:native Generating Client IVC proof
[13:19:32.503] INFO: pxe:bb:native bb - downloading bn254 crs... (mem: 208.66MiB)
...
[13:20:22.078] INFO: pxe:bb:native bb - ClientIVC: accumulating SchnorrAccount:entrypoint (mem: 259.38MiB)
[13:20:25.442] INFO: pxe:bb:native bb - ClientIVC: accumulating private_kernel_init
[13:20:32.582] INFO: pxe:bb:native bb - ClientIVC: accumulating SchnorrAccount:constructor
...
[13:22:50.982] INFO: pxe:bb:native bb - Goblin verified: 1 (mem: 773.06MiB)
[13:22:52.952] INFO: pxe:bb:native Generated IVC proof {"duration":216915.54319300002,"eventName":"circuit-proving"}

Waiting for account contract deployment...
Deploy tx hash:  0x2a6eb326ec032929102c28af6cce711e36edcebe1ac47ae680acb01eea89af3d
```
*   **`New account`**: Your wallet generated a new set of cryptographic keys for you.
*   **`Using Fee Juice for fee payment`**: The sandbox has a special contract called `FeeJuice` that gives you free funds to pay for transaction fees, making development easy.
*   **The Proving Process**: This huge wall of text is the most important part! Since creating an account is a private action (no one should know you created it until you choose to reveal it), your PXE must generate a Zero-Knowledge Proof.
    *   **`private-kernel-execution-prover`**: This starts the process. It runs the transaction logic locally to generate a "witness" - a trace of all the inputs and computations.
    *   **`pxe:bb:native Generating Client IVC proof`**: This invokes **Barretenberg** (`bb`), Aztec's powerhouse C++ library for all things cryptography. It's about to create a SNARK.
    *   **`downloading bn254 crs...`**: The first time you ever create a proof, `bb` needs to download a "Ceremony-trusted Setup" (CRS) file. This is a set of public parameters required for the specific SNARK construction (BN254). It's a large file, but it gets cached for all future proofs.
    *   **`ClientIVC: accumulating...`**: This is the heart of the process. A single Aztec transaction is actually composed of multiple smaller computations, each defined by a "kernel circuit". The logs show it creating proofs for and "folding" them together for each step:
        *   `SchnorrAccount:entrypoint` & `SchnorrAccount:constructor`: The logic for your account contract itself.
        *   `private_kernel_...`: These are the core Aztec protocol circuits that ensure all the rules of the network are followed (e.g., state is updated correctly, nullifiers are created, etc.).
    *   **`Goblin verified: 1`**: Goblin is Aztec's new cutting-edge proving system that contains among other things the ClientIVC prover. This log line indicates that the final, aggregated proof is valid.
    *   **`Waiting for account contract deployment...`**: The wallet sends the transaction, including the proof, to the Sequencer. It's now waiting for the Sequencer to include it in a block and for that block to be mined.

### 3. Deploying a Token Contract

The process is very similar to creating an account, as deploying a contract is also a private action.

**Command:**
```bash
aztec-wallet deploy TokenContractArtifact --from accounts:test0 --args accounts:test0 TestToken TST 18 -a testtoken
```
**Log Deep Dive:**
The logs show another full proving process. The key difference is the specific functions being called and proved. Instead of `SchnorrAccount:constructor`, the prover is now executing circuits related to contract deployment, like `ContractInstanceDeployer:deploy`. It proves that you, `test0`, have correctly initiated the deployment of a new contract with the specified constructor arguments.

### 4. Minting Public Tokens

Here you called a public function. But since you're calling it from your private account, there's still a private component.

**Command that Failed:**
```bash
aztec-wallet send mint_to_public --from accounts:test0 --contract-address contracts:testtoken --args accounts:test0 100
# Output: error: option '-ca, --contract-address <address>' argument 'contracts:testtoken' is invalid. Invalid address: contracts:testtoken
```
**Learning Moment**: This error is a great example of how small details matter. You deployed the contract with an alias `-a testtoken`. The wallet expects you to use that exact alias, `testtoken`, to refer to it. The `contracts:testtoken` syntax is valid but wasn't the alias you set. After you re-ran the `deploy` command, the alias was set correctly, and subsequent commands worked.

**Successful Mint Log Dive:**
```log
[13:42:33.196] INFO: pxe:service Simulating transaction execution...
Estimated gas usage:    da=2816,l2=81278,teardownDA=0,teardownL2=0
...
[13:42:49.435] INFO: pxe:private-kernel-execution-prover Private kernel witness generation took ...ms
...
Transaction has been mined
 Tx fee: 81277900
 Status: success
 Block number: 9
```
*   **`Simulating transaction`**: Before building a full proof, the PXE does a dry run to estimate the resources (gas) the transaction will consume.
*   **Proving Process**: Even for a public mint, your PXE needs to create a proof. Why? Because the *request* to call the public function comes from your private account. The proof validates your authority to make this call, without revealing who you are. The private kernel circuits process this request and generate a message to be executed by the public VM.
*   **`Transaction has been mined`**: The transaction was included in a block. The public state of the token contract was updated to reflect the new 100 tokens you minted.

### 5. & 7. Checking Balances (Public and Private)

**Commands:**
```bash
aztec-wallet simulate balance_of_public --from test0 --contract-address testtoken --args accounts:test0
# Simulation result:  100n

aztec-wallet simulate balance_of_private --from test0 --contract-address testtoken --args accounts:test0
# Simulation result:  25n
```
These are the simplest commands. The keyword `simulate` tells the PXE that this is a read-only request.
*   For `balance_of_public`, the PXE simply asks the Aztec node for the value in the public state tree associated with your address and the token contract. No proofs needed.
*   For `balance_of_private`, the PXE does something more complex. It scans its local database for all encrypted notes related to the `testtoken` contract that belong to `test0`. It uses `test0`'s private key to decrypt them, adds up the values, and shows you the result. This all happens locally on your machine; no information is sent to the network.

This covers the entire quickstart flow. Now you're ready to dive into the next tutorial and write some Noir code! 