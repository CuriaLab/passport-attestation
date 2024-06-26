use std::{
    env::var,
    future::IntoFuture,
    net::{Ipv4Addr, SocketAddrV4},
};

use alloy::{
    hex::FromHex,
    primitives::{Address, B256},
    providers::{Provider, ProviderBuilder},
    rpc::types::{BlockId, BlockTransactionsKind},
};
use anyhow::Result;
use ark_ec::{AffineRepr, CurveGroup};
use ark_ed_on_bn254::Fr as EdFr;
use ark_ff::{BigInteger, PrimeField};
use axum::{routing::get, Router};
use hyper::{header::CONTENT_TYPE, Method};
use reqwest::Url;
use sig_gen::{
    api::{router, State},
    crypto::EdAffine,
    query::RoleQuerier,
};
use tokio::{net::TcpListener, select};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    let provider = ProviderBuilder::new().on_http(Url::parse(&var("NODE_URL")?)?);
    let testnet_provider = var("TESTNET_NODE_URL")
        .ok()
        .map(|url| Some(ProviderBuilder::new().on_http(Url::parse(&url).ok()?)))
        .flatten();
    let testnet_anonymous_attestator = var("TESTNET_ANONYMOUS_ATTESTOR")
        .ok()
        .map(|addr| Address::from_hex(&addr).ok())
        .flatten();
    let testnet_pubkey_registry = var("TESTNET_KEY_REGISTRY")
        .ok()
        .map(|addr| Address::from_hex(&addr).ok())
        .flatten();
    let private_key = EdFr::from_be_bytes_mod_order(&hex::decode(&var("PRIVATE_KEY")?)?);
    let public_key = (EdAffine::generator() * private_key).into_affine();
    let pubkey_registry = Address::from_hex(&var("PUBKEY_REGISTRY")?)?;
    let anonymous_attestator = Address::from_hex(&var("ANONYMOUS_ATTESTOR")?)?;
    let proxy_private_key = B256::from_slice(&hex::decode(&var("PROXY_PRIVATE_KEY")?)?);

    if let Some(block) = provider
        .get_block(BlockId::latest(), BlockTransactionsKind::Hashes)
        .await?
    {
        info!(
            "Latest block {} at {}",
            block.header.number.unwrap(),
            block.header.timestamp
        );
    }

    let (role_querier, poller) = RoleQuerier::new().await?;

    let app = Router::new()
        .nest("/", router())
        .with_state(State {
            provider,
            testnet_provider,
            querier: role_querier,
            private_key,
            pubkey_registry,
            anonymous_attestator,
            proxy_private_key,
            testnet_pubkey_registry,
            testnet_anonymous_attestator,
        })
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::POST])
                .allow_headers([CONTENT_TYPE]),
        )
        .route("/", get(|| async { "Hello, World!" }));

    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .init();

    let port = var("PORT")
        .ok()
        .map(|p| p.parse().ok())
        .flatten()
        .unwrap_or(3010);

    info!("Starting server in port {}", port);
    info!("Pubkey Registry at {}", pubkey_registry);
    info!("Anonymous Attestator at {}", anonymous_attestator);
    info!(
        "Public Key: ({}, {})",
        hex::encode(public_key.x.into_bigint().to_bytes_be()),
        hex::encode(public_key.y.into_bigint().to_bytes_be())
    );
    select! {
        _ = axum::serve(
            TcpListener::bind(SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, port)).await?,
            app,
        ).into_future() => {}
        _ = poller => {}
    };

    Ok(())
}
