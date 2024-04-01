import * as anchor from '@coral-xyz/anchor';
import {
    Program,
    AnchorProvider,
    Wallet as AnchorWallet,
} from '@coral-xyz/anchor';
import { OrcaTest } from '../../target/types/orca_test';
import {
    PublicKey,
    Keypair,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Connection,
    Transaction,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
    ORCA_WHIRLPOOL_PROGRAM_ID,
    ORCA_WHIRLPOOLS_CONFIG,
    PDAUtil,
    PriceMath,
    WhirlpoolContext,
    buildWhirlpoolClient,
    PoolUtil,
    TickUtil,
    IGNORE_CACHE,
    increaseLiquidityQuoteByInputToken,
    SwapUtils,
    swapQuoteByInputToken,
} from '@orca-so/whirlpools-sdk';
import {
    createMint,
    mintTo,
    createAccount,
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    syncNative,
    AccountLayout,
} from '@solana/spl-token';
import {
    TransactionBuilder,
    Wallet,
    TransactionBuilderOptions,
    DecimalUtil,
    Percentage,
    resolveOrCreateATA,
} from '@orca-so/common-sdk';
import { assert } from 'chai';
import BN from 'bn.js';
import Decimal from 'decimal.js';

const TEST_PROVIDER_URL = 'http://localhost:8899';
const TEST_WALLET_SECRET = [
    76, 58, 227, 140, 84, 35, 34, 94, 210, 40, 248, 31, 56, 113, 4, 213, 195,
    67, 134, 52, 40, 117, 58, 13, 205, 25, 19, 0, 0, 97, 168, 144, 243, 234,
    176, 5, 119, 211, 100, 106, 160, 142, 58, 48, 144, 91, 203, 77, 198, 67,
    187, 148, 139, 159, 53, 68, 93, 59, 150, 69, 24, 221, 84, 37,
];

const sleep = second =>
    new Promise(resolve => setTimeout(resolve, second * 1000));

describe('orca-test', () => {
    const connection = new Connection(TEST_PROVIDER_URL, 'confirmed');
    const testWallet = Keypair.fromSecretKey(
        new Uint8Array(TEST_WALLET_SECRET),
    );
    const program = anchor.workspace.OrcaTest as Program<OrcaTest>;
    const provider = new AnchorProvider(
        connection,
        new AnchorWallet(testWallet),
        { commitment: 'confirmed' },
    );

    const wallet = provider.wallet as Wallet;

    let DEOK_MINT: PublicKey;
    let DEOK_KEYPAIR: Keypair;

    while (!DEOK_MINT) {
        const mint_keypair = Keypair.generate();
        const mint = mint_keypair.publicKey;
        const [mint_a, mint_b] = PoolUtil.orderMints(
            mint,
            new PublicKey('So11111111111111111111111111111111111111112'),
        );
        if (mint_a.toString() === mint.toString()) {
            DEOK_MINT = mint;
            DEOK_KEYPAIR = mint_keypair;
        }
    }
    const DEOK = {
        mint: DEOK_MINT,
        decimals: 9,
    };
    const SOL = {
        mint: new PublicKey('So11111111111111111111111111111111111111112'),
        decimals: 9,
    };

    const DEOK_ATA = getAssociatedTokenAddressSync(DEOK.mint, wallet.publicKey);
    const SOL_ATA = getAssociatedTokenAddressSync(SOL.mint, wallet.publicKey);

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

    const tick_spacing = 128;

    const fee_tier_128_pubkey = PDAUtil.getFeeTier(
        ORCA_WHIRLPOOL_PROGRAM_ID,
        ORCA_WHIRLPOOLS_CONFIG,
        tick_spacing,
    ).publicKey;

    const deok_sol_whirlpool_pubkey = PDAUtil.getWhirlpool(
        ORCA_WHIRLPOOL_PROGRAM_ID,
        ORCA_WHIRLPOOLS_CONFIG,
        DEOK.mint,
        SOL.mint,
        tick_spacing,
    ).publicKey;

    const position_mint_keypair = Keypair.generate();
    const position_mint = position_mint_keypair.publicKey;
    const position_pda = PDAUtil.getPosition(
        ORCA_WHIRLPOOL_PROGRAM_ID,
        position_mint,
    );

    const rent_ta = async () => {
        return connection.getMinimumBalanceForRentExemption(AccountLayout.span);
    };

    describe('initialize pool, open position, provide liguidity', () => {
        // token price new / sol
        const desiredMarketPrice = new Decimal(0.0005);
        // Shift by 64 bits
        const initial_sqrt_price = PriceMath.priceToSqrtPriceX64(
            desiredMarketPrice,
            9,
            9,
        );
        const initial_tick_current_index =
            PriceMath.sqrtPriceX64ToTickIndex(initial_sqrt_price);

        before(async () => {
            await createMint(
                connection,
                testWallet,
                wallet.publicKey,
                wallet.publicKey,
                9,
                DEOK_KEYPAIR,
                { commitment: 'confirmed' },
            )
                .then(res =>
                    createAccount(
                        connection,
                        testWallet,
                        DEOK.mint,
                        testWallet.publicKey,
                        undefined,
                        { commitment: 'confirmed' },
                    ),
                )
                .then(res =>
                    mintTo(
                        connection,
                        testWallet,
                        DEOK.mint,
                        DEOK_ATA,
                        testWallet,
                        BigInt('1000000000000000000'),
                        undefined,
                        { commitment: 'confirmed' },
                    ),
                )
                .then(res =>
                    createAccount(
                        connection,
                        testWallet,
                        SOL.mint,
                        testWallet.publicKey,
                        undefined,
                        { commitment: 'confirmed' },
                    ),
                )
                .then(res =>
                    (async () => {
                        const transaction = new Transaction().add(
                            SystemProgram.transfer({
                                fromPubkey: testWallet.publicKey,
                                toPubkey: SOL_ATA,
                                lamports: LAMPORTS_PER_SOL * 1000000,
                            }),
                        );

                        await sendAndConfirmTransaction(
                            connection,
                            transaction,
                            [testWallet],
                        );
                    })(),
                )
                .then(res =>
                    syncNative(connection, testWallet, SOL_ATA, {
                        commitment: 'confirmed',
                    }),
                );
        });
        it('execute proxy initialize_pool and initialize_tick_array', async () => {
            const deok_vault_keypair = Keypair.generate();
            const sol_vault_keypair = Keypair.generate();

            const initialize_pool = await program.methods
                .proxyInitializePool(tick_spacing, initial_sqrt_price)
                .accounts({
                    whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
                    whirlpoolsConfig: ORCA_WHIRLPOOLS_CONFIG,
                    tokenMintA: DEOK.mint,
                    tokenMintB: SOL.mint,
                    funder: wallet.publicKey,
                    whirlpool: deok_sol_whirlpool_pubkey,
                    tokenVaultA: deok_vault_keypair.publicKey,
                    tokenVaultB: sol_vault_keypair.publicKey,
                    feeTier: fee_tier_128_pubkey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .instruction();

            const start_tick_indexes = [
                TickUtil.getStartTickIndex(
                    initial_tick_current_index,
                    tick_spacing,
                    -4,
                ),
                TickUtil.getStartTickIndex(
                    initial_tick_current_index,
                    tick_spacing,
                    -3,
                ),
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
                TickUtil.getStartTickIndex(
                    initial_tick_current_index,
                    tick_spacing,
                    +3,
                ),
                TickUtil.getStartTickIndex(
                    initial_tick_current_index,
                    tick_spacing,
                    +4,
                ),
            ];

            const initialize_tick_arrays = await Promise.all(
                start_tick_indexes.map(start_tick_index => {
                    return program.methods
                        .proxyInitializeTickArray(start_tick_index)
                        .accounts({
                            whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
                            whirlpool: deok_sol_whirlpool_pubkey,
                            funder: wallet.publicKey,
                            tickArray: PDAUtil.getTickArray(
                                ORCA_WHIRLPOOL_PROGRAM_ID,
                                deok_sol_whirlpool_pubkey,
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
                    signers: [deok_vault_keypair, sol_vault_keypair],
                })
                .addInstruction({
                    instructions: initialize_tick_arrays,
                    cleanupInstructions: [],
                    signers: [],
                });

            const signature = await transaction.buildAndExecute();
            await connection.confirmTransaction(signature);

            // verification
            const deok_sol_whirlpool = await fetcher.getPool(
                deok_sol_whirlpool_pubkey,
            );
            assert(deok_sol_whirlpool.tokenMintA.equals(DEOK.mint));
            assert(deok_sol_whirlpool.tokenMintB.equals(SOL.mint));
            assert(deok_sol_whirlpool.tickSpacing === tick_spacing);
            assert(deok_sol_whirlpool.sqrtPrice.eq(initial_sqrt_price));

            const tickarray_pubkeys = start_tick_indexes.map(
                start_tick_index => {
                    return PDAUtil.getTickArray(
                        ORCA_WHIRLPOOL_PROGRAM_ID,
                        deok_sol_whirlpool_pubkey,
                        start_tick_index,
                    ).publicKey;
                },
            );
            const tickarrays = await Promise.all(
                tickarray_pubkeys.map(tickarray_pubkey => {
                    return fetcher.getTickArray(tickarray_pubkey);
                }),
            );
            tickarrays.forEach((tickarray, i) => {
                assert(tickarray.whirlpool.equals(deok_sol_whirlpool_pubkey));
                assert(tickarray.startTickIndex === start_tick_indexes[i]);
            });
        });

        it('execute proxy open_position', async () => {
            const position_ta = getAssociatedTokenAddressSync(
                position_mint,
                wallet.publicKey,
            );

            const [tick_lower_index, tick_upper_index] = [
                TickUtil.getStartTickIndex(
                    initial_tick_current_index,
                    tick_spacing,
                    -4,
                ),
                TickUtil.getStartTickIndex(
                    initial_tick_current_index,
                    tick_spacing,
                    +4,
                ),
            ];

            const open_position = await program.methods
                .proxyOpenPosition(tick_lower_index, tick_upper_index)
                .accounts({
                    whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
                    funder: wallet.publicKey,
                    owner: wallet.publicKey,
                    position: position_pda.publicKey,
                    positionMint: position_mint,
                    positionTokenAccount: position_ta,
                    whirlpool: deok_sol_whirlpool_pubkey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                })
                .instruction();

            const transaction = new TransactionBuilder(
                connection,
                wallet,
                transaction_builder_opts,
            ).addInstruction({
                instructions: [open_position],
                cleanupInstructions: [],
                signers: [position_mint_keypair],
            });

            const signature = await transaction.buildAndExecute();
            await connection.confirmTransaction(signature);

            const position_data = await fetcher.getPosition(
                position_pda.publicKey,
                IGNORE_CACHE,
            );
            assert(position_data.positionMint.equals(position_mint));
            assert(position_data.whirlpool.equals(deok_sol_whirlpool_pubkey));
            assert(position_data.tickLowerIndex === tick_lower_index);
            assert(position_data.tickUpperIndex === tick_upper_index);
            assert(position_data.liquidity.isZero());
        });

        it('execute proxy increase_liquidity', async () => {
            const deok_sol_whirlpool = await whirlpool_client.getPool(
                deok_sol_whirlpool_pubkey,
                IGNORE_CACHE,
            );
            const position_data = await fetcher.getPosition(
                position_pda.publicKey,
                IGNORE_CACHE,
            );

            const quote = increaseLiquidityQuoteByInputToken(
                SOL.mint,
                DecimalUtil.fromNumber(100000),
                position_data.tickLowerIndex,
                position_data.tickUpperIndex,
                Percentage.fromFraction(0, 1000),
                deok_sol_whirlpool,
            );

            const increase_liquidity = await program.methods
                .proxyIncreaseLiquidity(
                    quote.liquidityAmount,
                    quote.tokenMaxA,
                    quote.tokenMaxB,
                )
                .accounts({
                    whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
                    whirlpool: deok_sol_whirlpool_pubkey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    positionAuthority: wallet.publicKey,
                    position: position_pda.publicKey,
                    positionTokenAccount: getAssociatedTokenAddressSync(
                        position_mint,
                        wallet.publicKey,
                    ),
                    tokenOwnerAccountA: getAssociatedTokenAddressSync(
                        DEOK.mint,
                        wallet.publicKey,
                    ),
                    tokenOwnerAccountB: getAssociatedTokenAddressSync(
                        SOL.mint,
                        wallet.publicKey,
                    ),
                    tokenVaultA: deok_sol_whirlpool.getData().tokenVaultA,
                    tokenVaultB: deok_sol_whirlpool.getData().tokenVaultB,
                    tickArrayLower: PDAUtil.getTickArrayFromTickIndex(
                        position_data.tickLowerIndex,
                        tick_spacing,
                        deok_sol_whirlpool_pubkey,
                        ORCA_WHIRLPOOL_PROGRAM_ID,
                    ).publicKey,
                    tickArrayUpper: PDAUtil.getTickArrayFromTickIndex(
                        position_data.tickUpperIndex,
                        tick_spacing,
                        deok_sol_whirlpool_pubkey,
                        ORCA_WHIRLPOOL_PROGRAM_ID,
                    ).publicKey,
                })
                .instruction();

            const transaction = new TransactionBuilder(
                connection,
                wallet,
                transaction_builder_opts,
            ).addInstruction({
                instructions: [increase_liquidity],
                cleanupInstructions: [],
                signers: [],
            });

            const signature = await transaction.buildAndExecute();
            await connection.confirmTransaction(signature);

            const post_position_data = await fetcher.getPosition(
                position_pda.publicKey,
                IGNORE_CACHE,
            );
            const delta_liquidity = post_position_data.liquidity.sub(
                position_data.liquidity,
            );
            assert(delta_liquidity.eq(quote.liquidityAmount));
        });
    });

    describe('swap', () => {
        const user = Keypair.generate();
        const wallet = provider.wallet as Wallet;
        const sol_input = DecimalUtil.toBN(
            DecimalUtil.fromNumber(10 /* SOL */),
            SOL.decimals,
        );
        const count: Array<any> = new Array(10000);

        before(async () => {
            await (async () => {
                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: testWallet.publicKey,
                        toPubkey: user.publicKey,
                        lamports: LAMPORTS_PER_SOL * 20000000,
                    }),
                );

                await sendAndConfirmTransaction(connection, transaction, [
                    testWallet,
                ]);
            })();
        });
        it('execute multiple swap', async () => {
            count.forEach((_, i) => {
                describe('swap sol to deok', () => {
                    it(`swap sol to deok : ${i + 1} `, async () => {
                        const deok_sol_whirlpool = await fetcher.getPool(
                            deok_sol_whirlpool_pubkey,
                            IGNORE_CACHE,
                        );
                        const deok_sol_whirlpool_oracle_pubkey =
                            PDAUtil.getOracle(
                                ORCA_WHIRLPOOL_PROGRAM_ID,
                                deok_sol_whirlpool_pubkey,
                            ).publicKey;

                        const amount = new anchor.BN(sol_input);
                        const other_amount_threshold = new anchor.BN(0);
                        const amount_specified_is_input = true;
                        const a_to_b = false;
                        const sqrt_price_limit =
                            SwapUtils.getDefaultSqrtPriceLimit(a_to_b);

                        const tickarrays = SwapUtils.getTickArrayPublicKeys(
                            deok_sol_whirlpool.tickCurrentIndex,
                            deok_sol_whirlpool.tickSpacing,
                            a_to_b,
                            ORCA_WHIRLPOOL_PROGRAM_ID,
                            deok_sol_whirlpool_pubkey,
                        );

                        const wsol_ta = await resolveOrCreateATA(
                            connection,
                            user.publicKey,
                            SOL.mint,
                            rent_ta,
                            sol_input,
                        );
                        const deok_ta = await resolveOrCreateATA(
                            connection,
                            user.publicKey,
                            DEOK.mint,
                            rent_ta,
                        );

                        const swap = await program.methods
                            .proxySwap(
                                amount,
                                other_amount_threshold,
                                sqrt_price_limit,
                                amount_specified_is_input,
                                a_to_b,
                            )
                            .accounts({
                                whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
                                whirlpool: deok_sol_whirlpool_pubkey,
                                tokenAuthority: user.publicKey,
                                tokenVaultA: deok_sol_whirlpool.tokenVaultA,
                                tokenVaultB: deok_sol_whirlpool.tokenVaultB,
                                tokenOwnerAccountA: deok_ta.address,
                                tokenOwnerAccountB: wsol_ta.address,
                                tickArray0: tickarrays[0],
                                tickArray1: tickarrays[1],
                                tickArray2: tickarrays[2],
                                oracle: deok_sol_whirlpool_oracle_pubkey,
                                tokenProgram: TOKEN_PROGRAM_ID,
                            })
                            .instruction();

                        const transaction = new TransactionBuilder(
                            connection,
                            wallet,
                            transaction_builder_opts,
                        )
                            .addInstruction(wsol_ta)
                            .addInstruction(deok_ta)
                            .addInstruction({
                                instructions: [swap],
                                cleanupInstructions: [],
                                signers: [user],
                            });

                        // verification
                        const quote = await swapQuoteByInputToken(
                            await whirlpool_client.getPool(
                                deok_sol_whirlpool_pubkey,
                                IGNORE_CACHE,
                            ),
                            SOL.mint,
                            sol_input,
                            Percentage.fromFraction(0, 1000),
                            ORCA_WHIRLPOOL_PROGRAM_ID,
                            fetcher,
                            IGNORE_CACHE,
                        );

                        const pre_deok_ta = await fetcher.getTokenInfo(
                            deok_ta.address,
                            IGNORE_CACHE,
                        );
                        const pre_deok =
                            pre_deok_ta === null
                                ? new anchor.BN(0)
                                : pre_deok_ta.amount;

                        const signature = await transaction.buildAndExecute();
                        await connection.confirmTransaction(signature);
                        const post_deok_ta = await fetcher.getTokenInfo(
                            deok_ta.address,
                            IGNORE_CACHE,
                        );
                        const post_deok = post_deok_ta.amount;

                        const deok_output = new BN(post_deok.toString()).sub(
                            new BN(pre_deok.toString()),
                        );
                        assert(deok_output.eq(quote.estimatedAmountOut));
                    });
                });
            });
        });
    });
});
