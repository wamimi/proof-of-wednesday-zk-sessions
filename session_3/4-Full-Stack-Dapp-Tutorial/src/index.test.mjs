import { getDeployedTestAccountsWallets } from '@aztec/accounts/testing';
import { createPXEClient, waitForPXE } from '@aztec/aztec.js';
import { TokenContract } from '@aztec/noir-contracts.js/Token';

const {
  PXE_URL = "http://localhost:8080",
} = process.env;

describe("token contract", () => {
  let owner, recipient, token;

  beforeAll(async () => {
    const pxe = createPXEClient(PXE_URL);
    await waitForPXE(pxe);

    [owner, recipient] = await getDeployedTestAccountsWallets(pxe);

    const initialBalance = 69n;
    token = await TokenContract.deploy(owner, owner.getAddress(), 'TestToken', 'TST', 18).send().deployed();

    await token.methods.mint_to_private(owner.getAddress(), owner.getAddress(), initialBalance).send().wait();

    console.log(`Test Setup: Token deployed at ${token.address.toString()}`);
    console.log(`Test Setup: Owner balance initially ${initialBalance}`);
  }, 120_000);

  it('increases recipient funds on transfer', async () => {
    expect(await token.withWallet(recipient).methods.balance_of_private(recipient.getAddress()).simulate()).toEqual(0n);

    console.log(`Test: Transferring 20 tokens from ${owner.getAddress().toString()} to ${recipient.getAddress().toString()}`);
    await token.methods.transfer(recipient.getAddress(), 20n).send().wait();

    expect(await token.withWallet(recipient).methods.balance_of_private(recipient.getAddress()).simulate()).toEqual(20n);
  }, 30_000);
}); 