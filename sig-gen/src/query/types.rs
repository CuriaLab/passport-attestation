use alloy::sol;

sol! {
    #[sol(rpc)]
    contract OptimismToken {
        function getVotes(address account) external view returns (uint256);
        function delegates(address account) external view returns (address);
        function balanceOf(address account) external view returns (uint256);
    }
    struct Schema {
        string rpgfRound;
        address referredBy;
        string referredMethod;
    }
}

#[repr(u8)]
pub enum Role {
    Hidden,
    Badgeholder,
    Delegate,
    Delegator,
}

pub const ALL_ROLES: [Role; 4] = [
    Role::Hidden,
    Role::Badgeholder,
    Role::Delegate,
    Role::Delegator,
];
