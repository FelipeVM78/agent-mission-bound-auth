import "reflect-metadata";

import {
  UInt64
} from "o1js";

import {
  FinancialProjectionProgram,
  FinancialProjectionPublicInput,
  FinancialProjectionWitness
} from "../dist-zkapp/FinancialProjectionProgram.js";

const initialCapitalCents = 10_000_000n;
const contributionCents = 200_000n;
const monthlyRatePpm = 6434n;
const months =
  BigInt(process.env.FIN_MONTHS ?? "120");

const MAX_MONTHS = 360n;

if (
  months < 1n ||
  months > MAX_MONTHS
) {
  throw new Error(
    "O circuito suporta prazos entre 1 e 360 meses."
  );
}

const SCALE = 1_000_000n;

let balance = initialCapitalCents;

const balances = [balance];
const interests = [];
const remainders = [];

for (
  let month = 1n;
  month <= months;
  month += 1n
) {
  const numerator =
    balance * monthlyRatePpm;

  const interest =
    numerator / SCALE;

  const remainder =
    numerator % SCALE;

  interests.push(interest);
  remainders.push(remainder);

  balance =
    balance +
    interest +
    contributionCents;

  balances.push(balance);
}
const expectedFutureValueCents =
  balance;

/*
 * Completa o witness até 360 meses.
 */
while (
  interests.length < Number(MAX_MONTHS)
) {
  interests.push(0n);
  remainders.push(0n);
  balances.push(balance);
}


console.log("Preparando prova financeira ZK...");
console.log("");

console.log({
  initialCapitalBRL:
    Number(initialCapitalCents) / 100,

  monthlyContributionBRL:
    Number(contributionCents) / 100,

  monthlyRatePpm:
    Number(monthlyRatePpm),

  months:
    Number(months),

  expectedFutureValueBRL:
    Number(expectedFutureValueCents) / 100
});

const publicInput =
  new FinancialProjectionPublicInput({
    initialCapitalCents:
      UInt64.from(initialCapitalCents),

    monthlyContributionCents:
      UInt64.from(contributionCents),

    monthlyRatePpm:
      UInt64.from(monthlyRatePpm),

    months:
      UInt64.from(months),

    expectedFutureValueCents:
      UInt64.from(expectedFutureValueCents)
  });

const witness =
  new FinancialProjectionWitness({
    balances:
      balances.map((value) =>
        UInt64.from(value)
      ),

    interestQuotients:
      interests.map((value) =>
        UInt64.from(value)
      ),

    interestRemainders:
      remainders.map((value) =>
        UInt64.from(value)
      )
  });

console.log("");
console.log("Compilando FinancialProjectionProgram...");

const {
  verificationKey
} =
  await FinancialProjectionProgram.compile();

console.log("Circuito compilado.");

console.log("");
console.log(
  `Gerando prova ZK de ${months} meses...`
);

const { proof } =
  await FinancialProjectionProgram.proveProjection(
    publicInput,
    witness
  );

console.log("Prova gerada.");

console.log("");
console.log("Verificando prova...");

const valid =
  await FinancialProjectionProgram.verify(
    proof
  );

if (!valid) {
  throw new Error(
    "A prova financeira ZK não foi validada."
  );
}

console.log("");
console.log("==========================================");
console.log("FINANCIAL MATHEMATICS ZK PROOF: VALID");
console.log("==========================================");
console.log("");

console.log(
  JSON.stringify(
    {
      ok: true,

      proofVerified:
        valid,

      monthsVerified:
  Number(months),

      initialCapital:
        "R$ 100.000,00",

      monthlyContribution:
        "R$ 2.000,00",

      monthlyRatePpm:
        Number(monthlyRatePpm),

      monthlyRatePercent:
        Number(monthlyRatePpm) / 10_000,

      finalBalance:
        `R$ ${(Number(expectedFutureValueCents) / 100)
          .toLocaleString(
            "pt-BR",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }
          )}`,

      balancesChecked:
  Number(months) + 1,

interestCalculationsChecked:
  Number(months),

remainderConstraintsChecked:
  Number(months),

      verificationKeyHash:
        verificationKey.hash.toString()
    },
    null,
    2
  )
);