use ark_ec::{
    twisted_edwards::{Affine, MontCurveConfig, Projective, TECurveConfig},
    CurveConfig,
};
use ark_ed_on_bn254::{Fq, Fr};
use ark_ff::{Field, MontFp};

pub type EdAffine = Affine<EdConfig>;
pub type EdProjective = Projective<EdConfig>;

pub const BASE8: EdAffine = EdAffine::new_unchecked(
    MontFp!("5299619240641551281634865583518297030282874472190772894086521144482721001553"),
    MontFp!("16950150798460657717958625567821834550301663161624707787222815936182638968203"),
);

#[derive(Clone, Default, PartialEq, Eq)]
pub struct EdConfig;

impl CurveConfig for EdConfig {
    type BaseField = Fq;
    type ScalarField = Fr;

    /// COFACTOR = 8
    const COFACTOR: &'static [u64] = &[8];

    /// COFACTOR^(-1) mod r =
    /// 2394026564107420727433200628387514462817212225638746351800188703329891451411
    const COFACTOR_INV: Fr =
        MontFp!("2394026564107420727433200628387514462817212225638746351800188703329891451411");
}

impl TECurveConfig for EdConfig {
    const COEFF_A: Fq = MontFp!("168700");

    const COEFF_D: Fq = MontFp!("168696");

    const GENERATOR: EdAffine = EdAffine::new_unchecked(GENERATOR_X, GENERATOR_Y);

    type MontCurveConfig = EdConfig;
}

impl MontCurveConfig for EdConfig {
    const COEFF_A: Fq = MontFp!("168698");
    const COEFF_B: Fq = Fq::ONE;

    type TECurveConfig = EdConfig;
}

const GENERATOR_X: Fq =
    MontFp!("995203441582195749578291179787384436505546430278305826713579947235728471134");

const GENERATOR_Y: Fq =
    MontFp!("5472060717959818805561601436314318772137091100104008585924551046643952123905");
