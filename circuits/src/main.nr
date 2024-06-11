use dep::std::{ec::tecurve::affine::Point, eddsa::eddsa_poseidon_verify, hash::poseidon};

fn main(
    address: Field,
    sig_s: Field,
    sig_r: Point,
    pubkey: pub Point,
    role: pub Field,
    msg: pub Field,
    nonce: pub Field,
    revoker_hash: pub Field
) {
    let message = poseidon::bn254::hash_2([address, role]);
    let is_valid = eddsa_poseidon_verify(pubkey.x, pubkey.y, sig_s, sig_r.x, sig_r.y, message);

    assert(is_valid, "Signature is invalid");

    let _ = msg * msg;
    let _ = nonce * nonce;
    let revoker = poseidon::bn254::hash_3([message, sig_s, msg]);
    let calculated_revoker_hash = poseidon::bn254::hash_2([revoker, revoker]);

    assert(revoker_hash == calculated_revoker_hash, "Revoker hash is invalid");
}

#[test]
fn test_main() {}
