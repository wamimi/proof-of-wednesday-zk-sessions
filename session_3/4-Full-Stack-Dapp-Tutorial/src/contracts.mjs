import { AztecAddress, Contract, loadContractArtifact } from "@aztec/aztec.js";
import TokenContractJson from "../contracts/token/target/token-Token.json" with { type: "json" };
import { readFileSync } from "fs";

const TokenContractArtifact = loadContractArtifact(TokenContractJson);

export async function getToken(wallet) {
  const addresses = JSON.parse(readFileSync('addresses.json', 'utf8'));
  return Contract.at(AztecAddress.fromString(addresses.token), TokenContractArtifact, wallet);
} 