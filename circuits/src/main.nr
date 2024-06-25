use dep::std::{ec::tecurve::affine::Point, eddsa::eddsa_poseidon_verify, hash::poseidon};

fn main(
    address: Field,
    sig_s: Field,
    sig_r: Point,
    random_nonce: Field,
    revoker_secret: Field,
    pubkey: pub Point,
    role: pub Field,
    msg: pub Field,
    nonce: pub Field,
    timestamp: pub Field
) -> pub Field {
    let message = poseidon::bn254::hash_4([address, role, timestamp, random_nonce]);
    let is_valid = eddsa_poseidon_verify(pubkey.x, pubkey.y, sig_s, sig_r.x, sig_r.y, message);

    assert(is_valid, "Signature is invalid");

    let _ = msg * msg;
    let _ = nonce * nonce;
    let _ = timestamp * timestamp;
    let revoker = poseidon::bn254::hash_2([timestamp, revoker_secret]);
    let calculated_revoker_hash = poseidon::bn254::hash_2([revoker, revoker]);

    calculated_revoker_hash
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
    let revoker_hash = main(
        57005, // 0x000000000000000000000000000000000000dEaD
        1084962730721589343861882407938283729631298378329681939209113546914067968972,
        Point {
        x: 9511822940976101281659138595606619745991906839893458237629594161066286490837,
        y: 18714767357424465254042961065908942228149413171081771799954627430213815576545
    },
        123456789000, // random nonce
        126879297332596, // secret
        Point {
        x: 14362991499749677503784875617152783987369753795584406800566212563953275032114,
        y: 6253200752723491483166624601695387352044448859046905187389595930876836789475
    },
        1,
        17054503776152541198994743246136244729586576172916155597340346297690777997537, // H(Hello, world!)
        123456789,
        1718875852
    );
    assert_eq(revoker_hash, 9672195359866897248631522186500336244216588785587913256300043371390186885327);
}
