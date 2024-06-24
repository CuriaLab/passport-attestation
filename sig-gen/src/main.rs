use std::{
    env::var,
    future::IntoFuture,
    net::{Ipv4Addr, SocketAddrV4},
};

use alloy::{
    hex::FromHex,
    primitives::Address,
    providers::{Provider, ProviderBuilder},
    rpc::types::{BlockId, BlockTransactionsKind},
};
use anyhow::Result;
use ark_ec::{AffineRepr, CurveGroup};
use ark_ed_on_bn254::{EdwardsAffine, Fr as EdFr};
use ark_ff::{BigInteger, PrimeField};
use axum::{routing::get, Router};
use reqwest::Url;
use sig_gen::{
    api::{router, State},
    query::RoleQuerier,
};
use tokio::{net::TcpListener, select};
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    let provider = ProviderBuilder::new().on_http(Url::parse(&var("NODE_URL")?)?);
    let testnet_provider = var("TESTNET_URL")
        .ok()
        .map(|url| Some(ProviderBuilder::new().on_http(Url::parse(&url).ok()?)))
        .flatten();
    let private_key = EdFr::from_be_bytes_mod_order(&hex::decode(&var("PRIVATE_KEY")?)?);
    let public_key = (EdwardsAffine::generator() * private_key).into_affine();
    let pubkey_registry = Address::from_hex(&var("PUBKEY_REGISTRY")?)?;

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
        .route("/", get(|| async { "Hello, World!" }))
        .nest("/", router())
        .with_state(State {
            provider,
            testnet_provider,
            querier: role_querier,
            private_key,
            pubkey_registry,
        });

    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .init();

    info!("Starting server");
    info!("Pubkey Registry at {}", pubkey_registry);
    info!(
        "Public Key: ({}, {})",
        hex::encode(public_key.x.into_bigint().to_bytes_be()),
        hex::encode(public_key.y.into_bigint().to_bytes_be())
    );
    select! {
        _ = axum::serve(
            TcpListener::bind(SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, 3010)).await?,
            app,
        ).into_future() => {}
        _ = poller => {}
    };

    Ok(())
}
