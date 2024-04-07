use anchor_lang::prelude::*;

declare_id!("3SmnwsonVtHkHbApWRJkL4LPd72c66QrWFEX5EFdBppj");

#[program]
pub mod fairsale {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
