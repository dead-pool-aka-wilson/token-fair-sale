import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Moai } from '../../target/types/moai';
import { expect } from 'chai';

const MOAI = 'moai';
const MEME = 'meme';
const VOTE = 'vote';
const program = anchor.workspace.Moai as Program<Moai>;

export const getMoaiAddress = (authority: PublicKey) => {
    const [address, _] = PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode(MOAI), authority.toBuffer()],
        program.programId,
    );
    return address;
};

export const getMemeAddress = (index: string) => {
    const [address, _] = PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode(MEME), Buffer.from(index)],
        program.programId,
    );
    return address;
};

export const getVoteAddress = (userSpending: PublicKey, meme: PublicKey) => {
    const [address, _] = PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode(VOTE),
            userSpending.toBuffer(),
            meme.toBuffer(),
        ],
        program.programId,
    );
    return address;
};
