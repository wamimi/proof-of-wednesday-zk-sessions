use dep::aztec::{
    context::{PrivateContext, PublicContext, Context},
    log::emit_log,
    state_vars::{map::Map, public_state::PublicState, immutable_state::ImmutableState},
};

use dep::aztec::constants::{MAX_PRIVATE_CALL_STACK_LENGTH_PER_TX, MAX_PUBLIC_CALL_STACK_LENGTH_PER_TX};

use dep::authwit::{
    auth_witness::get_auth_witness,
    aztec_address::AztecAddress,
    entrypoint::{fee::FeePayload, app::AppPayload,},
    account::AccountActions,
};

use crate::types::{
    balance_set::BalanceSet,
    symbol::Symbol,
    name::Name
};

#[contract]
mod Token {
    use super::*;

    struct Storage {
        balances: Map<AztecAddress, BalanceSet>,
        total_supply: PublicState<Field>,
        minters: Map<AztecAddress, PublicState<bool>>,
        admin: ImmutableState<AztecAddress>,
        name: ImmutableState<Name>,
        symbol: ImmutableState<Symbol>,
        decimals: ImmutableState<u8>,
    }

    #[event]
    struct Transfer {
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
        from_balance: u128,
        to_balance: u128,
    }

    #[event]
    struct Mint {
        to: AztecAddress,
        amount: u128,
        new_total_supply: Field,
        minter: AztecAddress,
    }

    #[initializer]
    fn constructor(
        admin: AztecAddress,
        name: str<30>,
        symbol: str<5>,
        decimals: u8
    ) {
        storage.admin.initialize(admin);
        storage.minters.at(admin).set(true);
        storage.name.initialize(Name::from_str(name));
        storage.symbol.initialize(Symbol::from_str(symbol));
        storage.decimals.initialize(decimals);
    }

    #[private]
    fn mint_to_private(to: AztecAddress, amount: u128) {
        let new_total_supply = storage.total_supply.read() + (amount as Field);
        Token::at(context.this_address()).mint_public(to, amount, new_total_supply, context.msg_sender()).enqueue(&mut context);
        storage.balances.at(to).add(amount);
    }

    #[private]
    fn mint_to_private_from_public(from: AztecAddress, to: AztecAddress, amount: u128) {
        let auth = get_auth_witness(&mut context, from);
        assert(auth.is_valid_for(from), "Invalid signature");
        let new_total_supply = storage.total_supply.read() + (amount as Field);
        Token::at(context.this_address()).mint_public(to, amount, new_total_supply, from).enqueue(&mut context);
        storage.balances.at(to).add(amount);
    }

    #[internal]
    fn mint_public(to: AztecAddress, amount: u128, new_total_supply: Field, minter: AztecAddress) {
        assert(storage.minters.at(minter).read(), "Caller is not a minter");
        storage.total_supply.set(new_total_supply);
        emit_event(Mint { to, amount, new_total_supply, minter });
    }

    #[public]
    fn mint_to_public(to: AztecAddress, amount: u128) {
        assert(storage.minters.at(context.msg_sender()).read(), "Caller is not a minter");
        let new_total_supply = storage.total_supply.read() + (amount as Field);
        storage.total_supply.set(new_total_supply);
        storage.balances.at(to).add(amount);
        emit_event(Mint { to, amount, new_total_supply, minter: context.msg_sender() });
    }

    #[private]
    fn transfer(to: AztecAddress, amount: u128) {
        let from = context.msg_sender();
        let from_balance = storage.balances.at(from).remove(amount);
        let to_balance = storage.balances.at(to).add(amount);
        emit_event(Transfer { from, to, amount, from_balance, to_balance });
    }

    #[private]
    fn approve(spender: AztecAddress, amount: u128) {
        let owner = context.msg_sender();
        storage.balances.at(owner).add_allowance(spender, amount);
    }

    #[private]
    fn transfer_from(owner: AztecAddress, recipient: AztecAddress, amount: u128) {
        let caller = context.msg_sender();
        storage.balances.at(owner).remove_allowance(caller, amount);
        storage.balances.at(recipient).add(amount);
        emit_event(
            Transfer { from: owner, to: recipient, amount, from_balance: 0, to_balance: 0 }
        );
    }

    #[public]
    fn set_minter(minter: AztecAddress, approve: bool) {
        assert(storage.admin.read().eq(context.msg_sender()), "Caller is not the admin");
        storage.minters.at(minter).set(approve);
    }

    #[utility]
    unconstrained fn get_total_supply() -> Field {
        storage.total_supply.read()
    }

    #[utility]
    unconstrained fn balance_of_private(owner: AztecAddress) -> u128 {
        storage.balances.at(owner).balance_of()
    }

    #[utility]
    unconstrained fn balance_of_public(owner: AztecAddress) -> Field {
        0
    }

    #[utility]
    unconstrained fn get_name() -> str<30> {
        storage.name.read().as_str()
    }

    #[utility]
    unconstrained fn get_symbol() -> str<5> {
        storage.symbol.read().as_str()
    }

    #[utility]
    unconstrained fn get_decimals() -> u8 {
        storage.decimals.read()
    }

    #[utility]
    unconstrained fn get_admin() -> AztecAddress {
        storage.admin.read()
    }
} 