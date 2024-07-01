use alloy::{
    primitives::{Address, Bytes, B256},
    providers::ReqwestProvider,
    sol,
};
use anyhow::{bail, Result};
use ark_ed_on_bn254::Fr as EdFr;
use serde::Deserialize;

use crate::query::RoleQuerier;

#[derive(Debug, Clone)]
pub struct State {
    pub provider: ReqwestProvider,
    pub testnet_provider: Option<ReqwestProvider>,
    pub querier: RoleQuerier,
    pub private_key: EdFr,
    pub pubkey_registry: Address,
    pub testnet_pubkey_registry: Option<Address>,
    pub anonymous_attestator: Address,
    pub testnet_anonymous_attestator: Option<Address>,
    pub proxy_private_key: B256,
}

impl State {
    pub fn provider(&self, is_testnet: Option<bool>) -> Result<&ReqwestProvider> {
        match (is_testnet, self.testnet_provider.as_ref()) {
            (Some(true), Some(p)) => Ok(p),
            (Some(true), None) => {
                bail!("Testnet provider not set");
            }
            _ => Ok(&self.provider),
        }
    }

    pub fn pubkey_registry(&self, is_testnet: Option<bool>) -> Result<Address> {
        match (is_testnet, self.testnet_pubkey_registry) {
            (Some(true), Some(addr)) => Ok(addr),
            (Some(true), None) => {
                bail!("Testnet pubkey registry not set");
            }
            _ => Ok(self.pubkey_registry),
        }
    }

    pub fn anonymous_attestator(&self, is_testnet: Option<bool>) -> Result<Address> {
        match (is_testnet, self.testnet_anonymous_attestator) {
            (Some(true), Some(addr)) => Ok(addr),
            (Some(true), None) => {
                bail!("Testnet anonymous attestator not set");
            }
            _ => Ok(self.anonymous_attestator),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ProxyTransactionRequest {
    pub input: Bytes,
    pub is_testnet: Option<bool>,
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
