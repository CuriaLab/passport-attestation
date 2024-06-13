pub mod crypto;

#[cfg(test)]
mod tests {
    use anyhow::Result;
    use ark_bn254::Fr;
    use ark_ec::{AffineRepr, CurveGroup};
    use ark_ed_on_bn254::Fr as EdFr;
    use ark_ff::{BigInteger, PrimeField, UniformRand};
    use ark_std::test_rng;

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
}
