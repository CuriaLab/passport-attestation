use std::{collections::HashSet, sync::Arc};

use alloy::{
    primitives::{address, Address, Uint},
    providers::ReqwestProvider,
};
use anyhow::Result;
use reqwest::Client;
use serde_json::{from_value, json, Value};
use tokio::{
    spawn,
    sync::RwLock,
    task::JoinHandle,
    time::{interval, Duration},
    try_join,
};

pub mod attestation;
pub use attestation::*;
pub mod types;
use tracing::info;
pub use types::*;

const OPTIMISM_TOKEN_ADDRESS: Address = address!("4200000000000000000000000000000000000042");

#[derive(Debug, Clone)]
pub struct RoleQuerier {
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

    /// Create a new RoleQuerier instance and poll for badgeholders every 60 seconds.
    pub async fn new() -> Result<(Self, JoinHandle<()>)> {
        let badgeholders = Arc::new(RwLock::new(Self::fetch_badgeholders().await?));
        let b = badgeholders.clone();
        let poller = spawn(async move {
            let mut itv = interval(Duration::from_secs(60));
            loop {
                itv.tick().await;
                if let Ok(new_badgeholders) = Self::fetch_badgeholders().await {
                    info!("Updating badgeholders");
                    let mut badgeholders = b.write().await;
                    *badgeholders = new_badgeholders;
                }
            }
        });

        Ok((RoleQuerier { badgeholders }, poller))
    }

    pub async fn is_role(
        &self,
        provider: ReqwestProvider,
        address: Address,
        role: Role,
    ) -> Result<bool> {
        match role {
            Role::Hidden => Ok(true),
            Role::Badgeholder => self.is_badgeholder(address).await,
            Role::Delegate => self.is_delegate(provider, address).await,
            Role::Delegator => self.is_delegator(provider, address).await,
        }
    }

    async fn is_delegate(&self, provider: ReqwestProvider, address: Address) -> Result<bool> {
        let contract = OptimismToken::new(OPTIMISM_TOKEN_ADDRESS, provider);
        let votes = contract.getVotes(address).call().await?;
        Ok(votes._0 > Uint::ZERO)
    }

    async fn is_badgeholder(&self, address: Address) -> Result<bool> {
        let badgeholder_list = self.badgeholders.read().await;
        Ok(badgeholder_list.contains(&address))
    }

    async fn is_delegator(&self, provider: ReqwestProvider, address: Address) -> Result<bool> {
        let contract = OptimismToken::new(OPTIMISM_TOKEN_ADDRESS, provider);
        let d = || async { contract.delegates(address).call().await };
        let b = || async { contract.balanceOf(address).call().await };
        let (delegate, balance) = try_join!(d(), b())?;
        Ok(delegate._0 != Address::ZERO && balance._0 > Uint::ZERO)
    }
}
