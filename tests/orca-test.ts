import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OrcaTest } from "../target/types/orca_test";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Connection } from "@solana/web3.js";
import {
  ORCA_WHIRLPOOL_PROGRAM_ID, ORCA_WHIRLPOOLS_CONFIG,
  PDAUtil, PriceMath, SwapUtils,
  swapQuoteByInputToken, WhirlpoolContext, buildWhirlpoolClient,
  increaseLiquidityQuoteByInputToken, decreaseLiquidityQuoteByLiquidity,
  PoolUtil, IGNORE_CACHE, TickUtil,
} from "@orca-so/whirlpools-sdk";
import { createMint } from "@solana/spl-token";
import { TOKEN_PROGRAM_ID, AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { TransactionBuilder, resolveOrCreateATA, DecimalUtil, Percentage, Wallet, TransactionBuilderOptions } from "@orca-so/common-sdk";
import { assert, expect } from "chai";
import BN from "bn.js";

const SOL = {mint: new PublicKey("So11111111111111111111111111111111111111112"), decimals: 9};
const SAMO = {mint: new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"), decimals: 9};
const USDC = {mint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), decimals: 6};

describe("orca-test", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
const provider = anchor.getProvider();
  const program = anchor.workspace.OrcaTst as Program<OrcaTest>;

  const whirlpool_ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
  const fetcher = whirlpool_ctx.fetcher;
  const whirlpool_client = buildWhirlpoolClient(whirlpool_ctx);

  const transaction_builder_opts: TransactionBuilderOptions = {
    defaultBuildOption: { maxSupportedTransactionVersion: "legacy", blockhashCommitment: "confirmed" },
    defaultConfirmationCommitment: "confirmed",
    defaultSendOption: {
      skipPreflight: true,
    },
  };

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
