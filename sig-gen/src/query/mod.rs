use std::{collections::HashSet, sync::Arc};

use alloy::{
    dyn_abi::SolType,
    hex::FromHex,
    primitives::{address, Address, Bytes, Uint},
    providers::HyperProvider,
    sol,
};
use anyhow::Result;
use reqwest::Client;
use serde::{de::Error as DeError, Deserialize, Deserializer};
use serde_json::{from_value, json, Value};
use tokio::{sync::RwLock, try_join};

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

const OPTIMISM_TOKEN_ADDRESS: Address = address!("4200000000000000000000000000000000000042");

#[repr(u8)]
pub enum Role {
    None,
    Badgeholder,
    Delegate,
    Delegator,
}

#[derive(Debug, Deserialize)]
pub struct BadgeholderAttestation {
    pub recipient: Address,
    #[serde(deserialize_with = "data_from_string")]
    pub data: BadgeholderAttestationData,
}

#[derive(Debug, Deserialize)]
pub struct BadgeholderAttestationData {
    pub rpgf_round: u64,
    pub referred_by: Address,
    pub referred_method: String,
}

fn data_from_string<'de, D>(deserializer: D) -> Result<BadgeholderAttestationData, D::Error>
where
    D: Deserializer<'de>,
{
    String::deserialize(deserializer).and_then(|s| {
        let schema = Schema::abi_decode_sequence(
            &Bytes::from_hex(s).map_err(|_| DeError::custom("failed to decode hex"))?,
            false,
        )
        .map_err(|e| DeError::custom(format!("failed to decode schema: {}", e)))?;
        Result::Ok(BadgeholderAttestationData {
            rpgf_round: schema
                .rpgfRound
                .parse()
                .map_err(|_| DeError::custom("failed to parse rpgf_round"))?,
            referred_by: schema.referredBy,
            referred_method: schema.referredMethod,
        })
    })
}

impl BadgeholderAttestationData {
    pub fn rpgf_round_mut(&mut self) -> &mut u64 {
        &mut self.rpgf_round
    }

    pub fn referred_by_mut(&mut self) -> &mut Address {
        &mut self.referred_by
    }

    pub fn referred_method_mut(&mut self) -> &mut String {
        &mut self.referred_method
    }
}

#[derive(Debug)]
pub struct RoleQuerier {
    pub provider: Arc<HyperProvider>,
    pub badgeholders: Arc<RwLock<HashSet<Address>>>,
}

impl RoleQuerier {
    async fn fetch_badgeholders() -> Result<HashSet<Address>> {
        let client = Client::new();
        let response = client
            .post("https://optimism.easscan.org/graphql")
            .json(
                &json!({
                    "query": r#"
                        query Query($where: SchemaWhereUniqueInput!, $take: Int, $attestationsWhere2: AttestationWhereInput, $orderBy: [AttestationOrderByWithRelationInput!]) {
                          schema(where: $where) {
                            attestations(take: $take, where: $attestationsWhere2, orderBy: $orderBy) {
                              data
                              recipient
                            }
                          }
                        }
                    "#,
                    "variables": {
                      "where": {
                        "id": "0xfdcfdad2dbe7489e0ce56b260348b7f14e8365a8a325aef9834818c00d46b31b"
                      },
                      "take": 1000,
                      "attestationsWhere2": {
                        "attester": {
                          "in": [
                            "0x621477dBA416E12df7FF0d48E14c4D20DC85D7D9",
                            "0xE4553b743E74dA3424Ac51f8C1E586fd43aE226F"
                          ]
                        },
                        "revoked": {
                          "equals": false
                        }
                      },
                      "orderBy": [
                        {
                          "timeCreated": "desc"
                        }
                      ]
                    }
                })
            )
            .send()
            .await?;
        let attestations = from_value::<Vec<BadgeholderAttestation>>(
            response.json::<Value>().await?["data"]["schema"]["attestations"].clone(),
        )?;
        let latest_round = attestations
            .iter()
            .map(|a| a.data.rpgf_round)
            .max()
            .unwrap_or_default();
        let badgeholders = attestations
            .into_iter()
            .filter(|a| a.data.rpgf_round == latest_round)
            .map(|a| a.recipient)
            .collect::<HashSet<_>>();

        Ok(badgeholders)
    }

    pub async fn new(provider: Arc<HyperProvider>) -> Result<Self> {
        Ok(RoleQuerier {
            provider,
            badgeholders: Arc::new(RwLock::new(Self::fetch_badgeholders().await?)),
        })
    }

    pub async fn is_role(&self, address: Address, role: Role) -> Result<bool> {
        match role {
            Role::Badgeholder => self.is_badgeholder(address).await,
            Role::Delegate => self.is_delegate(address).await,
            Role::Delegator => self.is_delegator(address).await,
            _ => Ok(true),
        }
    }

    pub async fn is_delegate(&self, address: Address) -> Result<bool> {
        let contract = OptimismToken::new(OPTIMISM_TOKEN_ADDRESS, self.provider.clone());
        let votes = contract.getVotes(address).call().await?;
        Ok(votes._0 > Uint::ZERO)
    }

    pub async fn is_badgeholder(&self, address: Address) -> Result<bool> {
        let badgeholder_list = self.badgeholders.read().await;
        Ok(badgeholder_list.contains(&address))
    }

    pub async fn is_delegator(&self, address: Address) -> Result<bool> {
        let contract = OptimismToken::new(OPTIMISM_TOKEN_ADDRESS, self.provider.clone());
        let d = || async { contract.delegates(address).call().await };
        let b = || async { contract.balanceOf(address).call().await };
        let (delegate, balance) = try_join!(d(), b())?;
        Ok(delegate._0 != Address::ZERO && balance._0 > Uint::ZERO)
    }
}
