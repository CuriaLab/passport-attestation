FROM lukemathwalker/cargo-chef:latest-rust-1 AS chef
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder 
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies - this is the caching Docker layer!
RUN cargo chef cook --release --recipe-path recipe.json
# Build application
COPY . .
RUN cargo build --release --bin sig-gen

# We do not need the Rust toolchain to run the binary!
FROM debian:bookworm-slim AS runtime
RUN apt update && apt install -y libsasl2-dev libsasl2-2 openssl
WORKDIR /app
COPY --from=builder /app/target/release/sig-gen /usr/local/bin
ENV PORT=3010
EXPOSE $PORT
ENTRYPOINT ["/usr/local/bin/sig-gen"]
