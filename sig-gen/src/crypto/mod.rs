use anyhow::Result;
use ark_bn254::Fr;
use ark_ec::{AffineRepr, CurveGroup};
use ark_ed_on_bn254::Fr as EdFr;
use ark_ff::{BigInteger, PrimeField};
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
