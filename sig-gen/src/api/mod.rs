use std::time::{SystemTime, UNIX_EPOCH};

use alloy::{
    primitives::{FixedBytes, U256},
    providers::{
        network::{EthereumWallet, TransactionBuilder},
        Provider, ProviderBuilder,
    },
    rpc::types::TransactionRequest,
    signers::{k256::ecdsa::RecoveryId, local::PrivateKeySigner, Signature as AlloySignature},
};
use anyhow::Result;
use ark_ff::{BigInteger, PrimeField, UniformRand};
use ark_std::rand::rngs::OsRng;
use axum::{
    extract::{Json, State as AState},
    routing::post,
    Router,
};
use futures::future::try_join_all;
use hyper::StatusCode;
use serde_json::{json, Value};

use crate::{
    crypto::{eddsa_sign, eddsa_verify_message, hash, EdAffine},
    query::ALL_ROLES,
};

pub mod types;
pub use types::*;

pub fn router() -> Router<State> {
    Router::new()
        .route("/signature", post(signature))
        .route("/proxy", post(proxy))
}

pub async fn proxy(
    AState(state): AState<State>,
    Json(ProxyTransactionRequest { input, is_testnet }): Json<ProxyTransactionRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let provider = state.provider(is_testnet).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "message": format!("Failed to get provider: {}", e) })),
        )
    })?;

    let anonymous_attestator = state.anonymous_attestator(is_testnet).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "message": format!("Failed to get anonymous attestator: {}", e) })),
        )
    })?;

    let tx_hash = async {
        let provider = ProviderBuilder::new()
            .with_recommended_fillers()
            .wallet(EthereumWallet::new(PrivateKeySigner::from_bytes(
                &state.proxy_private_key,
            )?))
            .on_provider(provider);
        let tx_request = TransactionRequest::default()
            .to(anonymous_attestator)
            .with_input(input);
        let tx_hash = *provider.send_transaction(tx_request).await?.tx_hash();
        anyhow::Ok(tx_hash)
    }
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "message": format!("Failed to send transaction: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "tx_hash": tx_hash })))
}

pub async fn signature(
    AState(state): AState<State>,
    Json(SignatureBody { signature, address }): Json<SignatureBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let provider = state.provider;
    let message = format!("CURIA VERIFY ACCOUNT OWNERSHIP {}", address);

    if !match signature {
        Signature::ECDSA { r, s, v } => {
            let address_recovered = AlloySignature::from_rs_and_parity(
                U256::from_be_slice(&r),
                U256::from_be_slice(&s),
                RecoveryId::from_byte(v - 27).ok_or_else(|| {
                    (
                        StatusCode::BAD_REQUEST,
                        Json(json!({ "message": "Invalid v, recovery id" })),
                    )
                })?,
            )
            .map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "message": format!("Malformed ECDSA Signature: {}", e) })),
                )
            })?
            .recover_address_from_msg(&message)
            .map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "message": format!("Invalid ECDSA Signature: {}", e) })),
                )
            })?;

            address_recovered == address
        }
        Signature::EDDSA { r, s } => {
            let r = EdAffine {
                x: ark_ed_on_bn254::Fq::from_be_bytes_mod_order(&r[..32]),
                y: ark_ed_on_bn254::Fq::from_be_bytes_mod_order(&r[32..]),
            };
            let s = ark_ed_on_bn254::Fr::from_be_bytes_mod_order(&s);
            let registry = KeyRegistry::new(state.pubkey_registry, provider.clone());
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

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let signatures = ALL_ROLES
        .into_iter()
        .zip(
            try_join_all(
                ALL_ROLES.map(|role| state.querier.is_role(provider.clone(), address, role)),
            )
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
            let random_nonce = ark_ed_on_bn254::Fq::rand(&mut OsRng);
            let identity = hash(&[
                ark_ed_on_bn254::Fq::from_be_bytes_mod_order(address.as_ref()),
                ark_ed_on_bn254::Fq::from(role_u8),
                ark_ed_on_bn254::Fq::from(now),
                random_nonce
            ])?;
            let signature = eddsa_sign(state.private_key, identity)?;

            Ok(json!({
                "role": role_u8,
                "role_str": role,
                "sig_rx": format!("0x{}", hex::encode(signature.0.x.into_bigint().to_bytes_be())),
                "sig_ry": format!("0x{}", hex::encode(signature.0.y.into_bigint().to_bytes_be())),
                "sig_s": format!("0x{}", hex::encode(signature.1.into_bigint().to_bytes_be())),
                "random_nonce": format!("0x{}", hex::encode(random_nonce.into_bigint().to_bytes_be())),
            }))
        })
        .collect::<Result<Vec<_>>>()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "message": format!("Failed to sign: {}", e) })),
            )
        })?;

    Ok(Json(json!({
        "signatures": signatures,
        "timestamp": now,
    })))
}
