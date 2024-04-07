import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Moai } from '../../target/types/moai';
import { expect } from 'chai';

const MOAI = 'moai';
const program = anchor.workspace.Moai as Program<Moai>;

export const getMoaiAddress = (authority: PublicKey) => {
    const [address, _] = PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode(MOAI), authority.toBuffer()],
        program.programId,
    );
    return address;
};
