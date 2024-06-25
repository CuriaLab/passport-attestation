use alloy::primitives::{keccak256, Address};
use anyhow::{anyhow, bail, Result};
use ark_bn254::Fr;
use ark_ec::{AffineRepr, CurveGroup};
use ark_ed_on_bn254::Fr as EdFr;
use ark_ff::{BigInteger, Field, PrimeField};
use light_poseidon::{Poseidon, PoseidonHasher};

pub mod affine;
pub use affine::*;

pub fn pk8(sk: EdFr) -> EdAffine {
    let base8 = EdAffine::generator() * EdFr::from(8);
    (base8 * sk).into_affine()
}

pub fn convert<B: PrimeField>(a: &impl PrimeField) -> B {
    let bytes = a.into_bigint().to_bytes_be();
    B::from_be_bytes_mod_order(&bytes)
}

pub fn hash(inputs: &[Fr]) -> Result<Fr> {
    let mut poseidon = Poseidon::<Fr>::new_circom(inputs.len())?;
    let hash: Fr = poseidon.hash(inputs)?;
    Ok(hash)
}

pub fn eddsa_sign(sk: EdFr, message: Fr) -> Result<(EdAffine, EdFr)> {
    let base8 = EdAffine::generator() * EdFr::from(8);
    // pk = sk * G
    let pk = (EdAffine::generator() * sk).into_affine();
    // r = H(sk, M)
    let r = convert::<EdFr>(&hash(&[convert(&sk), message])?);
    // pk_r = r * G
    let pk_r8 = (base8 * &r).into_affine();
    // h = H(pk_r, pk, M)
    let h = convert::<EdFr>(&hash(&[pk_r8.x, pk_r8.y, pk.x, pk.y, message])?);
    // s = r + h * sk
    let s = r + h * sk;
    // sig = (pk_r, s)
    Ok((pk_r8, s))
}

pub fn eddsa_verify(pk: EdAffine, message: Fr, sig_r: EdAffine, sig_s: EdFr) -> Result<bool> {
    let base8 = EdAffine::generator() * EdFr::from(8);
    let pk8 = (pk * EdFr::from(8)).into_affine();
    assert!(pk.is_on_curve(), "pk is not on curve");
    assert!(pk8.is_on_curve(), "pk8 is not on curve");
    assert!(sig_r.is_on_curve(), "sig_r is not on curve");
    assert!(!sig_s.is_geq_modulus(), "sig_s is not in the field");

    // h = H(sig_r, pk, M)
    let h = convert::<EdFr>(&hash(&[sig_r.x, sig_r.y, pk.x, pk.y, message])?);
    // p1 = G * s
    let p1 = base8 * &sig_s;
    // p2 = pk * h + sig_r
    let p2 = pk8 * h + sig_r;
    // p1 == p2
    Ok(p1 == p2)
}

pub fn eddsa_verify_message(
    pk: EdAffine,
    message: &[u8],
    sig_r: EdAffine,
    sig_s: EdFr,
) -> Result<bool> {
    let m = Fr::from_be_bytes_mod_order(keccak256(message).as_ref());
    eddsa_verify(pk, m, sig_r, sig_s)
}

pub fn ecdsa_recover(
    message: &[u8],
    sig_r: ark_secp256k1::Fr,
    sig_s: ark_secp256k1::Fr,
    sig_v: u8,
) -> Result<ark_secp256k1::Affine> {
    let sig_v = match sig_v {
        27 | 0 => 0,
        28 | 1 => 1,
        _ => bail!("Invalid sig_v value"),
    };
    let y = ark_secp256k1::Affine::get_point_from_x_unchecked(
        convert::<ark_secp256k1::Fq>(&sig_r),
        sig_v == 1,
    )
    .ok_or(anyhow!("Invalid r or v, cannot recover r point"))?;
    let hashed_message = keccak256(
        [
            b"\x19Ethereum Signed Message:\n",
            message.len().to_string().as_bytes(),
            message,
        ]
        .concat(),
    )
    .to_vec();
    let m = ark_secp256k1::Fr::from_be_bytes_mod_order(&hashed_message);
    let rinv = sig_r.inverse().unwrap();
    let u1 = -m * rinv;
    let u2 = sig_s * rinv;
    let q = (ark_secp256k1::Affine::generator() * u1 + y * u2).into_affine();
    Ok(q)
}

pub fn pubkey_to_address(q: ark_secp256k1::Affine) -> Address {
    let pk_bytes = [
        q.x.into_bigint().to_bytes_be(),
        q.y.into_bigint().to_bytes_be(),
    ]
    .concat();
    let address = keccak256(&pk_bytes)[12..].to_vec();
    Address::from_slice(&address)
}

#[cfg(test)]
mod tests {
    use anyhow::Result;
    use ark_bn254::Fr;
    use ark_ec::{AffineRepr, CurveGroup};
    use ark_ed_on_bn254::Fr as EdFr;
    use ark_ff::{BigInteger, PrimeField, UniformRand};
    use ark_std::test_rng;
    use tiny_keccak::{Hasher, Keccak};

    use crate::crypto::*;

    #[test]
    fn correct_x5_noir_hash() -> Result<()> {
        let input_1 = Fr::from(1u32);
        let hashed = hash(&[input_1])?;
        assert_eq!(
            hex::encode(hashed.into_bigint().to_bytes_be()),
            "29176100eaa962bdc1fe6c654d6a3c130e96a4d1168b33848b897dc502820133"
        );

        let input_2 = Fr::from(2u32);
        let hashed = hash(&[input_1, input_2])?;

        assert_eq!(
            hex::encode(hashed.into_bigint().to_bytes_be()),
            "115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a"
        );

        Ok(())
    }

    #[test]
    fn correct_eddsa_sig() -> Result<()> {
        let mock_rng = &mut test_rng();

        let sk = EdFr::rand(mock_rng);
        let pk = (EdAffine::generator() * sk).into_affine();
        let message = Fr::rand(mock_rng);

        let (sig_r, sig_s) = eddsa_sign(sk, message)?;

        let is_valid = eddsa_verify(pk, message, sig_r, sig_s)?;
        assert!(is_valid, "Signature is invalid");

        Ok(())
    }

    #[test]
    fn print_noir_verify() -> Result<()> {
        let mock_rng = &mut test_rng();

        let sk = EdFr::rand(mock_rng);
        let pk = (EdAffine::generator() * sk).into_affine();
        let address =
            Fr::from_be_bytes_mod_order(&hex::decode("000000000000000000000000000000000000dEaD")?);
        let random_nonce = Fr::from(123456789000u64);
        let role = Fr::from(1);
        let timestamp = Fr::from(1718875852u64);
        let identity = hash(&[address, role, timestamp, random_nonce])?;
        let (sig_r, sig_s) = eddsa_sign(sk, identity)?;
        let mut hasher = Keccak::v256();
        hasher.update(b"Hello, world!");
        let mut raw_msg = [0u8; 32];
        hasher.finalize(&mut raw_msg);
        let msg = Fr::from_be_bytes_mod_order(&raw_msg);
        let nonce = Fr::from(123456789);
        let secret = Fr::from_be_bytes_mod_order(b"secret");
        let revoker = hash(&[timestamp, secret])?;
        let revoker_hash = hash(&[revoker, revoker])?;

        println!("address: {}", address);
        println!("sig_s: {}", sig_s);
        println!("sig_r: {}", sig_r);
        println!("random_nonce: {}", random_nonce);
        println!("pk: {}", pk);
        println!("role: {}", role);
        println!("msg: {}", msg);
        println!("nonce: {}", nonce);
        println!("timestamp: {}", timestamp);
        println!("revoker: {}", revoker);
        println!("secret: {}", secret);
        println!("revoker_hash: {}", revoker_hash);

        Ok(())
    }
}
