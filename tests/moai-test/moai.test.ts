import * as anchor from '@coral-xyz/anchor';
import {
    Program,
    AnchorProvider,
    Wallet as AnchorWallet,
} from '@coral-xyz/anchor';
import { Moai } from '../../target/types/moai';
import {
    PublicKey,
    Keypair,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Connection,
    LAMPORTS_PER_SOL,
    Transaction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { assert } from 'chai';
import BN from 'bn.js';
import { getMoaiAddress } from './util';

const TEST_PROVIDER_URL = 'http://localhost:8899';
const TEST_WALLET_SECRET = [
    76, 58, 227, 140, 84, 35, 34, 94, 210, 40, 248, 31, 56, 113, 4, 213, 195,
    67, 134, 52, 40, 117, 58, 13, 205, 25, 19, 0, 0, 97, 168, 144, 243, 234,
    176, 5, 119, 211, 100, 106, 160, 142, 58, 48, 144, 91, 203, 77, 198, 67,
    187, 148, 139, 159, 53, 68, 93, 59, 150, 69, 24, 221, 84, 37,
];

const SOL = {
    mint: new PublicKey('So11111111111111111111111111111111111111112'),
    decimals: 9,
};

const SPL_MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

describe('moai-test', () => {
    const connection = new Connection(TEST_PROVIDER_URL, 'confirmed');
    const testWallet = Keypair.fromSecretKey(
        new Uint8Array(TEST_WALLET_SECRET),
    );
    const program = anchor.workspace.Moai as Program<Moai>;
    const provider = new AnchorProvider(
        connection,
        new AnchorWallet(testWallet),
        { commitment: 'confirmed' },
    );

    const wallet = provider.wallet;

    const user = Keypair.generate();

    const rockMint = Keypair.generate();
    const moaiMint = Keypair.generate();
    const moai = getMoaiAddress(wallet.publicKey);

    const escrowAccount = getAssociatedTokenAddressSync(SOL.mint, moai, true);

    console.log('rockMint: ', rockMint.publicKey.toBase58());
    console.log('moaiMint: ', moaiMint.publicKey.toBase58());
    console.log('escrowAccount: ', escrowAccount.toBase58());
    console.log('moai: ', moai.toBase58());

    describe('initialize moai', () => {
        it('initialize moai', async () => {
            const signature = await program.methods
                .initializeMoai()
                .accounts({
                    authority: wallet.publicKey,
                    moai,
                    escrowAccount,
                    wsolMint: SOL.mint,
                    moaiMint: moaiMint.publicKey,
                    rockMint: rockMint.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .signers([moaiMint, rockMint])
                .rpc({ skipPreflight: true });

            console.log('initialize moai signature: ', signature);
        });
    });

    describe('user action', () => {
        const userSpending = Keypair.generate();
        const userRockAccount = getAssociatedTokenAddressSync(
            rockMint.publicKey,
            user.publicKey,
        );

        before(async () => {
            await (async () => {
                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: testWallet.publicKey,
                        toPubkey: user.publicKey,
                        lamports: LAMPORTS_PER_SOL * 10,
                    }),
                );

                await sendAndConfirmTransaction(connection, transaction, [
                    testWallet,
                ]);
            })();
        });

        it('deposit sol and mint rock', async () => {
            const signature = await program.methods
                .mintRock(new BN('19'))
                .accounts({
                    user: user.publicKey,
                    userSpending: userSpending.publicKey,
                    moai,
                    rockMint: rockMint.publicKey,
                    userRockAccount,
                    escrowAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    memoProgram: SPL_MEMO,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .signers([user, userSpending])
                .rpc({ skipPreflight: true });
            console.log('mint rock signature: ', signature);
        });
    });
});
