use anchor_lang::prelude::*;

pub mod instructions;
use instructions::*;

declare_id!("9kUZv9JjkuAsTEmauboSaCzBH5cfFjThyWecCeYXFQ5h");

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

    pub fn proxy_open_position(
        ctx: Context<ProxyOpenPosition>,
        tick_lower_index: i32,
        tick_upper_index: i32,
    ) -> Result<()> {
        return instructions::proxy_open_position::handler(ctx, tick_lower_index, tick_upper_index);
    }

    pub fn proxy_increase_liquidity(
        ctx: Context<ProxyIncreaseLiquidity>,
        liquidity: u128,
        token_max_a: u64,
        token_max_b: u64,
    ) -> Result<()> {
        return instructions::proxy_increase_liquidity::handler(
            ctx,
            liquidity,
            token_max_a,
            token_max_b,
        );
    }
}
