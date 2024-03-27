import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { OrcaTest } from '../target/types/orca_test';
import {
    PublicKey,
    Keypair,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Connection,
} from '@solana/web3.js';
import {
    ORCA_WHIRLPOOL_PROGRAM_ID,
    ORCA_WHIRLPOOLS_CONFIG,
    PDAUtil,
    PriceMath,
    SwapUtils,
    swapQuoteByInputToken,
    WhirlpoolContext,
    buildWhirlpoolClient,
    increaseLiquidityQuoteByInputToken,
    decreaseLiquidityQuoteByLiquidity,
    PoolUtil,
    IGNORE_CACHE,
    TickUtil,
} from '@orca-so/whirlpools-sdk';
import { createMint } from '@solana/spl-token';
import {
    TOKEN_PROGRAM_ID,
    AccountLayout,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
    TransactionBuilder,
    resolveOrCreateATA,
    DecimalUtil,
    Percentage,
    Wallet,
    TransactionBuilderOptions,
} from '@orca-so/common-sdk';
import { assert, expect } from 'chai';
import BN from 'bn.js';

console.log('here');

const SOL = {
    mint: new PublicKey('So11111111111111111111111111111111111111112'),
    decimals: 9,
};
const SAMO = {
    mint: new PublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'),
    decimals: 9,
};
const USDC = {
    mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    decimals: 6,
};

const TEST_WALLET_SECRET = [
    1, 62, 224, 23, 71, 125, 243, 82, 250, 21, 113, 130, 171, 89, 11, 153, 89,
    4, 47, 101, 182, 60, 144, 109, 181, 163, 145, 150, 102, 78, 156, 129, 167,
    207, 70, 158, 113, 250, 28, 163, 215, 77, 43, 135, 192, 208, 172, 76, 136,
    77, 108, 26, 82, 55, 38, 90, 21, 205, 196, 83, 235, 255, 162, 122,
];

describe('orca-test', () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    const connection = provider.connection;
    const wallet = provider.wallet as Wallet;
    const testWallet = Keypair.fromSecretKey(
        new Uint8Array(TEST_WALLET_SECRET),
    );

    anchor.setProvider(provider);

    const program = anchor.workspace.OrcaTest as Program<OrcaTest>;

    const whirlpool_ctx = WhirlpoolContext.withProvider(
        provider,
        ORCA_WHIRLPOOL_PROGRAM_ID,
    );
    const fetcher = whirlpool_ctx.fetcher;
    const whirlpool_client = buildWhirlpoolClient(whirlpool_ctx);

    const transaction_builder_opts: TransactionBuilderOptions = {
        defaultBuildOption: {
            maxSupportedTransactionVersion: 'legacy',
            blockhashCommitment: 'confirmed',
        },
        defaultConfirmationCommitment: 'confirmed',
        defaultSendOption: {
            skipPreflight: true,
        },
    };

    const sol_usdc_whirlpool_pubkey = PDAUtil.getWhirlpool(
        ORCA_WHIRLPOOL_PROGRAM_ID,
        ORCA_WHIRLPOOLS_CONFIG,
        SOL.mint,
        USDC.mint,
        64,
    ).publicKey;
    const samo_usdc_whirlpool_pubkey = PDAUtil.getWhirlpool(
        ORCA_WHIRLPOOL_PROGRAM_ID,
        ORCA_WHIRLPOOLS_CONFIG,
        SAMO.mint,
        USDC.mint,
        64,
    ).publicKey;

    const position_mint_keypair = Keypair.generate();

    const position_mint = position_mint_keypair.publicKey;
    const position_pda = PDAUtil.getPosition(
        ORCA_WHIRLPOOL_PROGRAM_ID,
        position_mint,
    );

    const verify_log = (logs: string[], message: string) => {
        expect(logs).includes(`Program log: verify! ${message}`);
    };
    const rent_ta = async () => {
        return connection.getMinimumBalanceForRentExemption(AccountLayout.span);
    };
    const sleep = second =>
        new Promise(resolve => setTimeout(resolve, second * 1000));

    it('execute proxy initialize_pool and initialize_tick_array', async () => {
        const samo_usdc_whirlpool = await fetcher.getPool(
            samo_usdc_whirlpool_pubkey,
        );

        let NEW_SAMO_MINT: PublicKey;
        while (!NEW_SAMO_MINT) {
            const mint = await createMint(
                connection,
                testWallet,
                wallet.publicKey,
                wallet.publicKey,
                9,
                undefined,
                { skipPreflight: true },
            );

            const [mint_a, mint_b] = PoolUtil.orderMints(mint, USDC.mint);

            if (mint_a.toString() === mint.toString()) {
                NEW_SAMO_MINT = mint;
            }

            console.log('mint', mint);
        }

        const tick_spacing = 128;
        const fee_tier_128_pubkey = PDAUtil.getFeeTier(
            ORCA_WHIRLPOOL_PROGRAM_ID,
            ORCA_WHIRLPOOLS_CONFIG,
            tick_spacing,
        ).publicKey;

        const new_samo_usdc_whirlpool_ts_128_pubkey = PDAUtil.getWhirlpool(
            ORCA_WHIRLPOOL_PROGRAM_ID,
            ORCA_WHIRLPOOLS_CONFIG,
            NEW_SAMO_MINT,
            USDC.mint,
            tick_spacing,
        ).publicKey;

        // use SAMO/USDC (ts=64) whirlpool price as initial sqrt price
        const initial_sqrt_price = samo_usdc_whirlpool.sqrtPrice;

        const new_samo_vault_keypair = Keypair.generate();
        const usdc_vault_keypair = Keypair.generate();

        const initialize_pool = await program.methods
            .proxyInitializePool(tick_spacing, initial_sqrt_price)
            .accounts({
                whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
                whirlpoolsConfig: ORCA_WHIRLPOOLS_CONFIG,
                tokenMintA: NEW_SAMO_MINT,
                tokenMintB: USDC.mint,
                funder: wallet.publicKey,
                whirlpool: new_samo_usdc_whirlpool_ts_128_pubkey,
                tokenVaultA: new_samo_vault_keypair.publicKey,
                tokenVaultB: usdc_vault_keypair.publicKey,
                feeTier: fee_tier_128_pubkey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .instruction();

        const initial_tick_current_index =
            PriceMath.sqrtPriceX64ToTickIndex(initial_sqrt_price);
        const start_tick_indexes = [
            TickUtil.getStartTickIndex(
                initial_tick_current_index,
                tick_spacing,
                -2,
            ),
            TickUtil.getStartTickIndex(
                initial_tick_current_index,
                tick_spacing,
                -1,
            ),
            TickUtil.getStartTickIndex(
                initial_tick_current_index,
                tick_spacing,
                0,
            ),
            TickUtil.getStartTickIndex(
                initial_tick_current_index,
                tick_spacing,
                +1,
            ),
            TickUtil.getStartTickIndex(
                initial_tick_current_index,
                tick_spacing,
                +2,
            ),
        ];

        const initialize_tick_arrays = await Promise.all(
            start_tick_indexes.map(start_tick_index => {
                return program.methods
                    .proxyInitializeTickArray(start_tick_index)
                    .accounts({
                        whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
                        whirlpool: new_samo_usdc_whirlpool_ts_128_pubkey,
                        funder: wallet.publicKey,
                        tickArray: PDAUtil.getTickArray(
                            ORCA_WHIRLPOOL_PROGRAM_ID,
                            new_samo_usdc_whirlpool_ts_128_pubkey,
                            start_tick_index,
                        ).publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .instruction();
            }),
        );

        const transaction = new TransactionBuilder(
            connection,
            wallet,
            transaction_builder_opts,
        )
            .addInstruction({
                instructions: [initialize_pool],
                cleanupInstructions: [],
                signers: [new_samo_vault_keypair, usdc_vault_keypair],
            })
            .addInstruction({
                instructions: initialize_tick_arrays,
                cleanupInstructions: [],
                signers: [],
            });

        const signature = await transaction.buildAndExecute(undefined, {
            skipPreflight: true,
        });
        await connection.confirmTransaction(signature);

        // verification
        const new_samo_usdc_whirlpool_ts_128 = await fetcher.getPool(
            new_samo_usdc_whirlpool_ts_128_pubkey,
        );
        assert(new_samo_usdc_whirlpool_ts_128.tokenMintA.equals(NEW_SAMO_MINT));
        assert(new_samo_usdc_whirlpool_ts_128.tokenMintB.equals(USDC.mint));
        assert(new_samo_usdc_whirlpool_ts_128.tickSpacing === tick_spacing);
        assert(new_samo_usdc_whirlpool_ts_128.sqrtPrice.eq(initial_sqrt_price));

        const tickarray_pubkeys = start_tick_indexes.map(start_tick_index => {
            return PDAUtil.getTickArray(
                ORCA_WHIRLPOOL_PROGRAM_ID,
                new_samo_usdc_whirlpool_ts_128_pubkey,
                start_tick_index,
            ).publicKey;
        });
        const tickarrays = await Promise.all(
            tickarray_pubkeys.map(tickarray_pubkey => {
                return fetcher.getTickArray(tickarray_pubkey);
            }),
        );
        tickarrays.forEach((tickarray, i) => {
            assert(
                tickarray.whirlpool.equals(
                    new_samo_usdc_whirlpool_ts_128_pubkey,
                ),
            );
            assert(tickarray.startTickIndex === start_tick_indexes[i]);
        });
    });
});
