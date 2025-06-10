import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { createPXEClient, waitForPXE } from '@aztec/aztec.js';
import { getToken } from './contracts.mjs';

const { PXE_URL = 'http://localhost:8080' } = process.env;

async function showPrivateBalances(pxe) {
  const [owner] = await getInitialTestAccountsWallets(pxe);
  const token = await getToken(owner);
  const accounts = await pxe.getRegisteredAccounts();
  for (const account of accounts) {
    const balance = await token.methods.balance_of_private(account.address).simulate();
    console.log(`Private balance of ${account.address}: ${balance}`);
  }
}

async function showPublicBalances(pxe) {
  const [owner] = await getInitialTestAccountsWallets(pxe);
  const token = await getToken(owner);
  const accounts = await pxe.getRegisteredAccounts();
  for (const account of accounts) {
    const balance = await token.methods.balance_of_public(account.address).simulate();
    console.log(`Public Balance of ${account.address}: ${balance}`);
  }
}

async function mintPrivateFunds(pxe) {
  const [ownerWallet] = await getInitialTestAccountsWallets(pxe);
  const token = await getToken(ownerWallet);
  console.log('\nBalances BEFORE private minting:');
  await showPrivateBalances(pxe);
  const mintAmount = 20n;
  const from = ownerWallet.getAddress();
  console.log(`\nMinting ${mintAmount} private tokens to ${ownerWallet.getAddress().toString()}...`);
  await token.methods.mint_to_private(from, ownerWallet.getAddress(), mintAmount).send().wait();
  console.log('\nBalances AFTER private minting:');
  await showPrivateBalances(pxe);
}

async function mintPublicFunds(pxe) {
  const [owner] = await getInitialTestAccountsWallets(pxe);
  const token = await getToken(owner);
  console.log('\nPublic Balances BEFORE public mint:');
  await showPublicBalances(pxe);
  console.log(`\nSending public mint transaction, awaiting transaction to be mined`);
  const receipt = await token.methods.mint_to_public(owner.getAddress(), 100n).send().wait();
  console.log(`Transaction ${receipt.txHash} has been mined on block ${receipt.blockNumber}`);
  console.log('\nPublic Balances AFTER public mint:');
  await showPublicBalances(pxe);
  const blockNumber = await pxe.getBlockNumber();
  const logs = (await pxe.getPublicLogs({ fromBlock: blockNumber - 1 })).logs;
  const textLogs = logs.map(extendedLog => extendedLog.toHumanReadable().slice(0, 200));
  for (const log of textLogs) console.log(`Log emitted: ${log}`);
}

async function transferPrivateFunds(pxe) {
  const [owner, recipient] = await getInitialTestAccountsWallets(pxe);
  const token = await getToken(owner);
  console.log('\nBalances BEFORE transfer:');
  await showPrivateBalances(pxe);
  const transferAmount = 1n;
  console.log(`\nTransferring ${transferAmount} private tokens from ${owner.getAddress().toString()} to ${recipient.getAddress().toString()}...`);
  const receipt = await token.methods.transfer(recipient.getAddress(), transferAmount).send().wait();
  console.log(`Transaction ${receipt.txHash} has been mined on block ${receipt.blockNumber}`);
  console.log('\nBalances AFTER transfer:');
  await showPrivateBalances(pxe);
}

async function main() {
  const pxe = createPXEClient(PXE_URL);
  await waitForPXE(pxe);

  const nodeInfo = await pxe.getNodeInfo();
  console.log('Aztec Sandbox Info:', nodeInfo);

  await mintPrivateFunds(pxe);
  await mintPublicFunds(pxe);
  await transferPrivateFunds(pxe);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
}); 