import {
  Provable,
  Struct,
  UInt64,
  ZkProgram
} from "o1js";

const MAX_MONTHS = 360;
const RATE_SCALE = UInt64.from(1_000_000);
const RATE_SCALE_FIELD = RATE_SCALE.value;
const ANNUAL_RATE_TOLERANCE_PPM = 5n;
export class FinancialProjectionPublicInput extends Struct({
  initialCapitalCents: UInt64,
  monthlyContributionCents: UInt64,
  monthlyRatePpm: UInt64,
  months: UInt64,
  expectedFutureValueCents: UInt64,
  annualRatePpm: UInt64,
}) {}

export class FinancialProjectionWitness extends Struct({
  balances: Provable.Array(UInt64, MAX_MONTHS + 1),
  interestQuotients: Provable.Array(UInt64, MAX_MONTHS),
  interestRemainders: Provable.Array(UInt64, MAX_MONTHS)
}) {}

export const FinancialProjectionProgram = ZkProgram({
  name: "financial-projection",

  publicInput: FinancialProjectionPublicInput,

  methods: {
    proveProjection: {
      privateInputs: [FinancialProjectionWitness],

      async method(
        input: FinancialProjectionPublicInput,
        witness: FinancialProjectionWitness
      ) {
        witness.balances[0].assertEquals(
          input.initialCapitalCents
        );
/*
 * Limites de seguranÃ§a para evitar
 * overflow modular nas potÃªncias.
 */
input.monthlyRatePpm.assertLessThanOrEqual(
  UInt64.from(1_000_000)
);

input.annualRatePpm.assertLessThanOrEqual(
  UInt64.from(1_000_000)
);

/*
 * Verifica:
 *
 * (1 + taxa mensal)^12
 * ~=
 * (1 + taxa anual)
 *
 * em escala PPM.
 */
const monthlyGross =
  RATE_SCALE_FIELD.add(
    input.monthlyRatePpm.value
  );

let monthlyGrossPower =
  monthlyGross;

for (
  let i = 1;
  i < 12;
  i += 1
) {
  monthlyGrossPower =
    monthlyGrossPower.mul(
      monthlyGross
    );
}

let annualScaled =
  RATE_SCALE_FIELD.add(
    input.annualRatePpm.value
  );

for (
  let i = 0;
  i < 11;
  i += 1
) {
  annualScaled =
    annualScaled.mul(
      RATE_SCALE_FIELD
    );
}

let toleranceScaled =
  RATE_SCALE_FIELD;

for (
  let i = 0;
  i < 10;
  i += 1
) {
  toleranceScaled =
    toleranceScaled.mul(
      RATE_SCALE_FIELD
    );
}

toleranceScaled =
  toleranceScaled.mul(
    ANNUAL_RATE_TOLERANCE_PPM
  );

/*
 * |monthlyGrossPower - annualScaled|
 * <= toleranceScaled
 *
 * sem usar abs().
 */
monthlyGrossPower
  .lessThanOrEqual(
    annualScaled.add(
      toleranceScaled
    )
  )
  .assertTrue();

annualScaled
  .lessThanOrEqual(
    monthlyGrossPower.add(
      toleranceScaled
    )
  )
  .assertTrue();
        UInt64.from(0)
          .lessThan(input.months)
          .assertTrue();

        UInt64.from(MAX_MONTHS)
          .lessThan(input.months)
          .assertFalse();

        for (
          let month = 0;
          month < MAX_MONTHS;
          month += 1
        ) {
          const current =
            witness.balances[month];

          const next =
            witness.balances[month + 1];

          const interest =
            witness.interestQuotients[month];

          const remainder =
            witness.interestRemainders[month];

          const active =
            UInt64.from(month)
              .lessThan(input.months);

          const activeField =
            active.toField();

          current.value
            .mul(input.monthlyRatePpm.value)
            .mul(activeField)
            .assertEquals(
              interest.value
                .mul(RATE_SCALE.value)
                .add(remainder.value)
            );

          remainder
            .lessThan(RATE_SCALE)
            .assertTrue();

          next.value.assertEquals(
            current.value.add(
              activeField.mul(
                interest.value.add(
                  input.monthlyContributionCents.value
                )
              )
            )
          );
        }

        witness.balances[MAX_MONTHS]
          .assertEquals(
            input.expectedFutureValueCents
          );
      }
    }
  }
});

export class FinancialProjectionProof extends ZkProgram.Proof(
  FinancialProjectionProgram
) {}
