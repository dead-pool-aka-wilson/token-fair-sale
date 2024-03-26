use anchor_lang::prelude::*;

pub mod instructions;
use instructions::*;

declare_id!("Auk5McF2qPTR2f1CXxvg8MGPSiPGusULqE5k2sLjJy7g");

#[program]
pub mod orca_test {
    use super::*;

    pub fn verify_whirlpools_config_account(
        ctx: Context<VerifyWhirlpoolsConfigAccount>,
      ) -> Result<()> {
        return instructions::verify_account::handler_whirlpools_config(ctx);
      }
    
      pub fn verify_feetier_account(
        ctx: Context<VerifyFeeTierAccount>,
      ) -> Result<()> {
        return instructions::verify_account::handler_feetier(ctx);
      }
    
      pub fn verify_whirlpool_account(
        ctx: Context<VerifyWhirlpoolAccount>,
      ) -> Result<()> {
        return instructions::verify_account::handler_whirlpool(ctx);
      }
    
      pub fn verify_tickarray_account(
        ctx: Context<VerifyTickArrayAccount>,
        sampling1: u32,
        sampling2: u32,
        sampling3: u32,
        sampling4: u32,
        sampling5: u32,
        sampling6: u32,
        sampling7: u32,
        sampling8: u32,
      ) -> Result<()> {
        return instructions::verify_account::handler_tickarray(
          ctx,
          sampling1, sampling2, sampling3, sampling4,
          sampling5, sampling6, sampling7, sampling8,
        );
      }
    
      pub fn verify_position_account(
        ctx: Context<VerifyPositionAccount>,
      ) -> Result<()> {
        return instructions::verify_account::handler_position(ctx);
      }

      pub fn proxy_initialize_pool(
        ctx: Context<ProxyInitializePool>,
        tick_spacing: u16,
        initial_sqrt_price: u128,
      ) -> Result<()> {
        return instructions::proxy_initialize_pool::handler(
          ctx,
          tick_spacing,
          initial_sqrt_price,
        );
      }
}


