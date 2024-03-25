use anchor_lang::prelude::*;

declare_id!("Auk5McF2qPTR2f1CXxvg8MGPSiPGusULqE5k2sLjJy7g");

#[program]
pub mod orca_test {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
