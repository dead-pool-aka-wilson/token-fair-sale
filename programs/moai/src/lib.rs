use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    memo::{build_memo, BuildMemo, Memo},
    token::{
        approve_checked, mint_to, sync_native, ApproveChecked, Mint, MintTo, SyncNative, Token,
        TokenAccount,
    },
};

const ROCK_PRICE: u64 = 9900000;
const FEE: u64 = 100000;

pub fn amount_to_ui_amount_string(amount: u64, decimals: u8) -> String {
    let decimals = decimals as usize;
    if decimals > 0 {
        // Left-pad zeros to decimals + 1, so we at least have an integer zero
        let mut s = format!("{:01$}", amount, decimals + 1);
        // Add the decimal point (Sorry, "," locales!)
        s.insert(s.len() - decimals, '.');
        s
    } else {
        amount.to_string()
    }
}

declare_id!("2Svk2fb1YwpjKrxktUabBsYYm49HiXyxHpAAAK5g6K9t");

#[program]
pub mod moai {

    use super::*;

    pub fn initialize_moai(ctx: Context<InitializeMoai>) -> Result<()> {
        let moai = &mut ctx.accounts.moai;
        moai.nonce = ctx.bumps.moai;
        moai.authority = *ctx.accounts.authority.key;
        moai.current_top_vote = None;
        moai.mutable = true;
        moai.epoch = 0;
        moai.escrow_account = *ctx.accounts.escrow_account.to_account_info().key;
        moai.moai_mint_account = *ctx.accounts.moai_mint.to_account_info().key;
        moai.rock_mint_account = *ctx.accounts.rock_mint.to_account_info().key;

        Ok(())
    }

    pub fn create_meme(
        ctx: Context<CreateMeme>,
        _index: String,
        name: String,
        uri: String,
    ) -> Result<()> {
        let meme = &mut ctx.accounts.meme;
        meme.name = name;
        meme.uri = uri;
        meme.creator = *ctx.accounts.user.key;

        Ok(())
    }

    pub fn mint_rock<'a>(ctx: Context<MintRock>, amount: u64) -> Result<()> {
        let signer_seeds: &[&[u8]] = &[
            b"moai".as_ref(),
            ctx.accounts.moai.authority.as_ref(),
            &[ctx.accounts.moai.nonce],
        ];

        // Transfer Sol to Escrow
        let sol_transfer_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.escrow_account.to_account_info(),
            },
        );

        let sol_transfer_amount_rock = amount * ROCK_PRICE; // 1 ROCK = 0.099 SOL
        system_program::transfer(sol_transfer_context, sol_transfer_amount_rock)?;

        sync_native(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SyncNative {
                    account: ctx.accounts.escrow_account.to_account_info(),
                },
            )
            .with_signer(&[&signer_seeds[..]]),
        )?;

        // Transfer Sol to Spending Wallet
        let sol_transfer_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.user_spending.to_account_info(),
            },
        );

        let sol_transfer_amount_fee = amount * FEE; // FEE = 0.001 SOL / ROCK
        system_program::transfer(sol_transfer_context, sol_transfer_amount_fee)?;

        // Mint ROCK
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.rock_mint.to_account_info(),
                    to: ctx.accounts.user_rock_account.to_account_info(),
                    authority: ctx.accounts.moai.to_account_info(),
                },
            )
            .with_signer(&[&signer_seeds[..]]),
            amount,
        )?;

        approve_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                ApproveChecked {
                    to: ctx.accounts.user_rock_account.to_account_info(),
                    mint: ctx.accounts.rock_mint.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                    delegate: ctx.accounts.user_spending.to_account_info(),
                },
            ),
            amount,
            0,
        )?;

        let memo = format!("Minted {} $ROCK with {} SOL & keep {} SOL to spending wallet ({}) for tx fee in future. You can withdraw SOL in spending wallet any time", amount, amount_to_ui_amount_string(sol_transfer_amount_rock, 9),  amount_to_ui_amount_string(sol_transfer_amount_fee, 9), ctx.accounts.user_spending.to_account_info().key);

        // MEMO
        build_memo(
            CpiContext::new(ctx.accounts.memo_program.to_account_info(), BuildMemo {}),
            memo.as_bytes(),
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMoai<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer=authority, space= 8+Moai::INIT_SPACE, seeds=[b"moai".as_ref(), authority.key().as_ref()], bump)]
    pub moai: Account<'info, Moai>,
    #[account(init, payer=authority, associated_token::mint=wsol_mint, associated_token::authority=moai)]
    pub escrow_account: Account<'info, TokenAccount>,
    pub wsol_mint: Account<'info, Mint>,
    #[account(init, payer=authority, mint::authority=moai, mint::decimals=9, mint::freeze_authority=moai)]
    pub moai_mint: Account<'info, Mint>,
    #[account(init, payer=authority, mint::authority=moai, mint::decimals=0, mint::freeze_authority=moai)]
    pub rock_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(index: String)]
pub struct CreateMeme<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(init, payer=user, space= 8+Meme::INIT_SPACE, seeds=[b"meme".as_ref(), index.as_ref()], bump)]
    pub meme: Account<'info, Meme>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintRock<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_spending: Signer<'info>,
    pub moai: Account<'info, Moai>,
    #[account(mut)]
    pub rock_mint: Account<'info, Mint>,
    #[account(init_if_needed, payer=user, associated_token::mint = rock_mint, associated_token::authority = user)]
    pub user_rock_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub escrow_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub memo_program: Program<'info, Memo>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
#[derive(InitSpace, Default)]
pub struct Moai {
    pub authority: Pubkey,
    pub current_top_vote: Option<Pubkey>,
    pub epoch: u64,
    pub escrow_account: Pubkey,
    pub moai_mint_account: Pubkey,
    pub rock_mint_account: Pubkey,
    pub nonce: u8,
    pub mutable: bool,
}

#[account]
#[derive(InitSpace, Default)]
pub struct Meme {
    #[max_len(32)]
    pub name: String,
    #[max_len(100)]
    pub uri: String,
    pub creator: Pubkey,
}
