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
import { getDeployedTestAccountsWallets } from "@aztec/accounts/testing";
import { createLogger } from "@aztec/foundation/log";
import { format } from "util";
import path from "path";
import { fileURLToPath } from "url";

// --- CONFIG ---
const { PXE_URL = "http://localhost:8080" } = process.env;
const logger = createLogger("aztec:http-pxe-client");
// --- END CONFIG ---

/**
 * A class that provides a wallet interface for a custom Schnorr account contract.
 * It's main purpose is to override the `createAuthWit` method to provide a custom signature.
 */
class SchnorrHardcodedAccountWallet extends AccountWallet {
  constructor(pxe: PXE, address: CompleteAddress, privateKey: GrumpkinScalar) {
    super(pxe, address, new AuthWitnessProvider(privateKey));
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // --- 1. Connect to PXE and get accounts ---
  const pxe = createPXEClient(PXE_URL, { fetch: mustSucceedFetch });
  await waitForPXE(pxe, logger);
  const nodeInfo = await pxe.getNodeInfo();
  logger.info(format("Aztec Sandbox Info:", nodeInfo));

  // --- 2. Compile and Deploy the Custom Account Contract ---
  logger.info("Compiling account contract...");

  // We are assuming that the schnorr_account_contract was compiled using the command
  // `aztec-nargo compile` in the `schnorr_account_contract` directory
  const accountContractArtifact = new SchnorrAccountContract().artifact;

  // --- 3. Create the Account Manager and Wallet ---
  const privateKey = GrumpkinScalar.random();
  const publicKey = generatePublicKey(privateKey);

  const accountManager = new AccountManager(pxe, privateKey, accountContractArtifact);

  logger.info("Deploying custom account contract...");
  const wallet = await accountManager.deploy(publicKey).wait();
  logger.info(`Custom account deployed at: ${wallet.getAddress().toString()}`);

  // --- 4. Use the Custom Account to Deploy and Interact with a Token Contract ---
  logger.info("Deploying Token contract with custom account...");

  const tokenContract = await TokenContract.deploy(
    wallet, // The custom account wallet
    wallet.getAddress(),
    "TestToken",
    "TKN",
    18
  ).send().deployed();

  logger.info(`Token contract deployed at: ${tokenContract.address.toString()}`);

  // Now, let's use the custom account to mint tokens
  const mintAmount = 100n;
  logger.info(`Minting ${mintAmount} tokens to own account...`);
  
  await tokenContract.methods.mint_to_private(wallet.getAddress(), wallet.getAddress(), mintAmount).send().wait();

  const balance = await tokenContract.methods.balance_of_private(wallet.getAddress()).simulate();
  logger.info(`Private balance of custom account: ${balance}`);

  if (balance !== mintAmount) {
    throw new Error(`Expected balance of ${mintAmount} but got ${balance}`);
  }

  logger.info("Successfully used custom account to deploy and interact with a contract!");
}

main().catch((err) => {
  logger.error("Error in main function: ", err);
  process.exit(1);
}); 