use alloy::{
    primitives::{Address, Bytes},
    providers::ReqwestProvider,
    sol,
};
use ark_ed_on_bn254::Fr as EdFr;
use serde::Deserialize;

use crate::query::RoleQuerier;

#[derive(Debug, Clone)]
pub struct State {
    pub provider: ReqwestProvider,
    pub querier: RoleQuerier,
    pub private_key: EdFr,
    pub pubkey_registry: Address,
}

#[derive(Debug, Deserialize)]
pub struct SignatureBody {
    pub signature: Signature,
    pub address: Address,
}

#[derive(Debug, Deserialize)]
pub enum Signature {
    ECDSA { r: Bytes, s: Bytes, v: u8 },
    EDDSA { r: Bytes, s: Bytes },
}

sol! {
    #[sol(rpc)]
    contract KeyRegistry {
        struct Key {
            bytes32 x;
            bytes32 y;
        }
        function key(address addr) external view returns (Key memory);
    }
}
