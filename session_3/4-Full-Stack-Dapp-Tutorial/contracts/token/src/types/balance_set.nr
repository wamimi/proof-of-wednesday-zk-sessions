use dep::uint_note::balance_utils::BalanceUtils;
use dep::aztec::aztec_address::AztecAddress;

// The BalanceSet is a wrapper around the BalanceUtils library
// It is used to manage the private balance of a user
// and their allowances
struct BalanceSet {
    balance_utils: BalanceUtils<128>,
}

impl BalanceSet {
    // Get a BalanceSet for a given user
    pub fn at(owner: AztecAddress) -> Self {
        BalanceSet { balance_utils: BalanceUtils::new(owner, 0) }
    }

    // Add an amount to the user's balance
    pub fn add(self, amount: u128) -> u128 {
        self.balance_utils.add(amount)
    }

    // Remove an amount from the user's balance
    pub fn remove(self, amount: u128) -> u128 {
        self.balance_utils.remove(amount)
    }

    // Get the user's balance
    pub fn balance_of(self) -> u128 {
        self.balance_utils.get_balance()
    }

    // Add an allowance for a spender
    pub fn add_allowance(self, spender: AztecAddress, amount: u128) {
        self.balance_utils.add_allowance(spender, amount)
    }

    // Remove an allowance for a spender
    pub fn remove_allowance(self, spender: AztecAddress, amount: u128) {
        self.balance_utils.remove_allowance(spender, amount)
    }
} 