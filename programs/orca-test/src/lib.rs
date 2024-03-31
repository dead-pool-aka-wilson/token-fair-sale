use anchor_lang::prelude::*;

pub mod instructions;
use instructions::*;

declare_id!("8bd9cEM4gmXkUBe31rs1Virzk5DnC1je13RqDWufwXdm");

#[program]
pub mod orca_test {
    use super::*;

    pub fn proxy_initialize_pool(
        ctx: Context<ProxyInitializePool>,
        tick_spacing: u16,
        initial_sqrt_price: u128,
    ) -> Result<()> {
        return instructions::proxy_initialize_pool::handler(ctx, tick_spacing, initial_sqrt_price);
    }

    pub fn proxy_initialize_tick_array(
        ctx: Context<ProxyInitializeTickArray>,
        start_tick_index: i32,
    ) -> Result<()> {
        return instructions::proxy_initialize_tick_array::handler(ctx, start_tick_index);
    }
}
