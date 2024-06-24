use std::time::{SystemTime, UNIX_EPOCH};

use alloy::primitives::FixedBytes;
use anyhow::Result;
use ark_ff::{BigInteger, PrimeField};
use axum::{
    extract::{Json, State as AState},
    routing::post,
    Router,
};
use futures::future::try_join_all;
use hyper::StatusCode;
use serde_json::{json, Value};

use crate::{
    crypto::{ecdsa_recover, eddsa_sign, eddsa_verify_message, hash, pubkey_to_address, EdAffine},
    query::ALL_ROLES,
};

pub mod types;
pub use types::*;

pub fn router() -> Router<State> {
    Router::new().route("/signature", post(signature))
}

pub async fn signature(
    AState(State {
        querier,
        testnet_provider,
        private_key,
        provider,
        pubkey_registry,
    }): AState<State>,
    Json(SignatureBody {
        signature,
        address,
        is_testnet,
    }): Json<SignatureBody>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    let provider = match (is_testnet, testnet_provider) {
        (Some(true), Some(p)) => p,
        (Some(true), None) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "message": "Testnet provider not set" })),
            ))
        }
        _ => provider,
    };
    let message = format!("CURIA VERIFY ACCOUNT OWNERSHIP {}", address);

    if !match signature {
        Signature::ECDSA { r, s, v } => {
            let r = ark_secp256k1::Fr::from_be_bytes_mod_order(&r);
            let s = ark_secp256k1::Fr::from_be_bytes_mod_order(&s);
            let pubkey_recovered = ecdsa_recover(message.as_bytes(), r, s, v).map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "message": format!("Invalid ECDSA Signature: {}", e) })),
                )
            })?;
            let address_recovered = pubkey_to_address(pubkey_recovered);
            address_recovered == address
        }
        Signature::EDDSA { r, s } => {
            let r = EdAffine {
                x: ark_ed_on_bn254::Fq::from_be_bytes_mod_order(&r[..32]),
                y: ark_ed_on_bn254::Fq::from_be_bytes_mod_order(&r[32..]),
            };
            let s = ark_ed_on_bn254::Fr::from_be_bytes_mod_order(&s);
            let registry = KeyRegistry::new(pubkey_registry, provider.clone());
            let key = registry.key(address).call().await.map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "message": format!("Failed to get key: {}", e) })),
                )
            })?;

            if key._0.x == FixedBytes::ZERO && key._0.y == FixedBytes::ZERO {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "message": "Invalid public key" })),
                ));
            }

            let pubkey = EdAffine {
                x: ark_ed_on_bn254::Fq::from_be_bytes_mod_order(key._0.x.as_ref()),
                y: ark_ed_on_bn254::Fq::from_be_bytes_mod_order(key._0.y.as_ref()),
            };

            eddsa_verify_message(pubkey, message.as_bytes(), r, s).unwrap_or_default()
        }
    } {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "message": "Invalid signature"
            })),
        ));
    }

    let now_truncated_day = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        / 86400
        * 86400;

    let signatures = ALL_ROLES
        .into_iter()
        .zip(
            try_join_all(ALL_ROLES.map(|role| querier.is_role(provider.clone(), address, role)))
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "message": format!("Failed to query role: {}", e) })),
                    )
                })?,
        )
        .filter(|(_, i)| *i)
        .map(|(role, _)| -> Result<Value> {
            let role_u8 = role as u8;
            let identity = hash(&[
                ark_ed_on_bn254::Fq::from_be_bytes_mod_order(address.as_ref()),
                ark_ed_on_bn254::Fq::from(role_u8),
                ark_ed_on_bn254::Fq::from(now_truncated_day),
            ])?;
            let signature = eddsa_sign(private_key, identity)?;

            Ok(json!({
                "role": role_u8,
                "role_str": role,
                "sig_rx": format!("0x{}", hex::encode(signature.0.x.into_bigint().to_bytes_be())),
                "sig_ry": format!("0x{}", hex::encode(signature.0.y.into_bigint().to_bytes_be())),
                "sig_s": format!("0x{}", hex::encode(signature.1.into_bigint().to_bytes_be())),
            }))
        })
        .collect::<Result<Vec<_>>>()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "message": format!("Failed to sign: {}", e) })),
            )
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "signatures": signatures,
            "timestamp": now_truncated_day,
        })),
    ))
}
