use anchor_lang::prelude::*;

pub mod instructions;
use instructions::*;

declare_id!("Auk5McF2qPTR2f1CXxvg8MGPSiPGusULqE5k2sLjJy7g");

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
