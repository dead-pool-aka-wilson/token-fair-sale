use anchor_lang::prelude::*;

declare_id!("2Svk2fb1YwpjKrxktUabBsYYm49HiXyxHpAAAK5g6K9t");

#[program]
pub mod moai {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
