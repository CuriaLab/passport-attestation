use alloy::{
    dyn_abi::SolType,
    hex::FromHex,
    primitives::{Address, Bytes},
};
use serde::{de::Error as DeError, Deserialize, Deserializer};

use super::Schema;

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
