use dep::std::{ec::tecurve::affine::Point, eddsa::eddsa_poseidon_verify, hash::poseidon};

fn main(
    address: Field,
    sig_s: Field,
    sig_r: Point,
    pubkey: pub Point,
    role: pub Field,
    msg: pub Field,
    nonce: pub Field,
    revoker_hash: pub Field,
    timestamp: pub Field
) {
    let message = poseidon::bn254::hash_3([address, role, timestamp]);
    let is_valid = eddsa_poseidon_verify(pubkey.x, pubkey.y, sig_s, sig_r.x, sig_r.y, message);

    assert(is_valid, "Signature is invalid");

    let _ = msg * msg;
    let _ = nonce * nonce;
    let _ = timestamp * timestamp;
    let revoker = poseidon::bn254::hash_3([message, sig_s, msg]);
    let calculated_revoker_hash = poseidon::bn254::hash_2([revoker, revoker]);

    assert(revoker_hash == calculated_revoker_hash, "Revoker hash is invalid");
}

#[test]
fn test_poseidon_verify() {
    let pubkey = Point {
        x: 14362991499749677503784875617152783987369753795584406800566212563953275032114,
        y: 6253200752723491483166624601695387352044448859046905187389595930876836789475
    };
    let msg = 5880579452694111398038816184147859226105113334752339841727721355533812240766;
    let sig_r = Point {
        x: 10793895791883109599192972640563574047199347124929952699445165579794585700241,
        y: 16798855385506348957735124354927061181664959024731552934829695110011700077882
    };
    let sig_s = 182806536495521076865308901135233590028054592601582246148179419832659989658;
    let is_valid = eddsa_poseidon_verify(pubkey.x, pubkey.y, sig_s, sig_r.x, sig_r.y, msg);
    assert(is_valid, "Signature is invalid");
}

#[test]
fn test_main() {
    main(
        57005, // 0x000000000000000000000000000000000000dEaD
        1427860297441759022677808574306996626835089094313226040373638034714511660633,
        Point {
        x: 20427897995191784322958268816791911454025156511622737324617550098495648896371,
        y: 13475945305366082258359349275262445747601356417482798206955229178435023280121
    },
        Point {
        x: 14362991499749677503784875617152783987369753795584406800566212563953275032114,
        y: 6253200752723491483166624601695387352044448859046905187389595930876836789475
    },
        1,
        5735816763073854953388147237921, // Hello, world!
        123456789,
        14041675743261546148041887336962757586381464911329133868108739484314530314422,
        1718875852
    );
}
