import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { id, sha256Hex } from "../../packages/protocol/digest.js";
import { isProductionProfile } from "../../packages/protocol/runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATASET_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "private-datasets.json"
);

export async function loadDatasets() {
  return JSON.parse(
    await fs.readFile(DATASET_PATH, "utf8")
  );
}

export function datasetCommitment(dataset) {
  return sha256Hex({
    id: dataset.id,
    owner: dataset.owner,
    title: dataset.title,
    classification: dataset.classification,
    records: dataset.records
  });
}

export function buildPolicy(dataset, operation) {
  return {
    version: "private-compute-policy-v1",
    datasetId: dataset.id,
    operation,
    requiredScopes: [...dataset.allowedScopes],

    minCohortSize: Number(
      process.env.PRIVATE_COMPUTE_MIN_COHORT ??
        (isProductionProfile() ? 3 : 2)
    ),

    disclosure: "aggregate-output-only",
    rawDataEgress: false
  };
}

/*
|--------------------------------------------------------------------------
| FINANCIAL PROJECTION AGENT
|--------------------------------------------------------------------------
*/

function parseNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const normalized = String(value)
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace("%", "")
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    throw new Error(
      `Invalid numeric value: ${value}`
    );
  }

  return number;
}

function extractValue(query, aliases) {
  for (const alias of aliases) {
    const regex = new RegExp(
      `${alias}\\s*[:=]\\s*([0-9.,]+)\\s*%?`,
      "i"
    );

    const match = query.match(regex);

    if (match) {
      return parseNumber(match[1]);
    }
  }

  return null;
}

export function parseFinancialQuery(query) {
  const initialCapital = extractValue(
    query,
    [
      "initialCapital",
      "initial capital",
      "capital inicial"
    ]
  );

  const monthlyContribution = extractValue(
    query,
    [
      "monthlyContribution",
      "monthly contribution",
      "aporte mensal"
    ]
  );

  const annualRate = extractValue(
    query,
    [
      "annualRate",
      "annual rate",
      "taxa anual",
      "rentabilidade anual"
    ]
  );

  const years = extractValue(
    query,
    [
      "years",
      "anos",
      "prazo"
    ]
  );

  const inflationRate = extractValue(
    query,
    [
      "inflationRate",
      "inflation rate",
      "inflação",
      "inflacao"
    ]
  );

  const missing = [];

  if (initialCapital === null) {
    missing.push("capital inicial");
  }

  if (monthlyContribution === null) {
    missing.push("aporte mensal");
  }

  if (annualRate === null) {
    missing.push("taxa anual");
  }

  if (years === null) {
    missing.push("prazo em anos");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing financial parameters: ${missing.join(", ")}`
    );
  }

  return {
    initialCapital,
    monthlyContribution,
    annualRate: annualRate / 100,
    years,

    inflationRate:
      inflationRate === null
        ? 0
        : inflationRate / 100
  };
}

export function calculateFinancialProjection({
  initialCapital,
  monthlyContribution,
  annualRate,
  years,
  inflationRate
}) {
  if (initialCapital < 0) {
    throw new Error(
      "Initial capital cannot be negative."
    );
  }

  if (monthlyContribution < 0) {
    throw new Error(
      "Monthly contribution cannot be negative."
    );
  }

  if (annualRate <= -1) {
    throw new Error(
      "Annual rate must be greater than -100%."
    );
  }

  if (years <= 0) {
    throw new Error(
      "Years must be greater than zero."
    );
  }

  if (inflationRate <= -1) {
    throw new Error(
      "Inflation rate must be greater than -100%."
    );
  }

  const months = Math.round(
    years * 12
  );
if (
  months < 1 ||
  months > 360
) {
  throw new Error(
    "Financial projection term must be between 1 and 360 months."
  );
}
    /*
   * Converte a taxa anual efetiva
   * para taxa mensal equivalente.
   *
   * Em seguida, converte a taxa mensal
   * para PPM, exatamente como o circuito ZK.
   */
  const rawMonthlyRate =
    Math.pow(
      1 + annualRate,
      1 / 12
    ) - 1;

  const monthlyRatePpm =
    Math.round(
      rawMonthlyRate * 1_000_000
    );

  /*
   * Esta passa a ser a taxa mensal
   * efetivamente utilizada tanto pelo
   * cálculo quanto pela prova ZK.
   */
  const monthlyRate =
    monthlyRatePpm / 1_000_000;

  const SCALE =
    1_000_000n;

  /*
   * O circuito trabalha em centavos inteiros.
   */
  const initialCapitalCents =
    BigInt(
      Math.round(
        initialCapital * 100
      )
    );

  const monthlyContributionCents =
    BigInt(
      Math.round(
        monthlyContribution * 100
      )
    );

  const monthlyRatePpmBigInt =
    BigInt(monthlyRatePpm);

  let balanceCents =
    initialCapitalCents;

  /*
   * Mesma matemática do circuito:
   *
   * numerator =
   *   balance * monthlyRatePpm
   *
   * interest =
   *   floor(numerator / 1_000_000)
   *
   * balance =
   *   balance + interest + contribution
   */
  for (
    let month = 1;
    month <= months;
    month += 1
  ) {
    const numerator =
      balanceCents *
      monthlyRatePpmBigInt;

    const interestCents =
      numerator / SCALE;

    balanceCents =
      balanceCents +
      interestCents +
      monthlyContributionCents;
  }

  /*
   * Converte novamente de centavos
   * para reais apenas para apresentação.
   */
  const balance =
    Number(balanceCents) / 100;

  const totalContributedCents =
    initialCapitalCents +
    monthlyContributionCents *
      BigInt(months);

  const totalContributed =
    Number(totalContributedCents) /
    100;

  const investmentReturnCents =
    balanceCents -
    totalContributedCents;

  const investmentReturn =
    Number(investmentReturnCents) /
    100;

  /*
   * Valor real é derivado do patrimônio
   * nominal já calculado pela mesma
   * matemática do circuito.
   */
  const realFutureValue =
    balance /
    Math.pow(
      1 + inflationRate,
      years
    );

  const realAnnualRate =
    inflationRate === 0
      ? annualRate
      : (
          (1 + annualRate) /
          (1 + inflationRate)
        ) - 1;

  return {
    initialCapital,
    monthlyContribution,

    years,
    months,

    annualRate,
    monthlyRate,

    inflationRate,
    realAnnualRate,

    futureValue:
      balance,

    totalContributed,

    investmentReturn,

    realFutureValue
  };
}

function formatBRL(value) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2
    }
  ).format(value);
}

function formatPercent(value) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(value);
}

function buildFinancialOutput(query) {
  const inputs =
    parseFinancialQuery(query);

  const projection =
    calculateFinancialProjection(
      inputs
    );

  const answer = [
    "Financial Projection Agent completed the calculation.",
    "",
    `Patrimônio futuro: ${formatBRL(
      projection.futureValue
    )}`,
    `Total aportado: ${formatBRL(
      projection.totalContributed
    )}`,
    `Rendimento acumulado: ${formatBRL(
      projection.investmentReturn
    )}`,
    `Valor futuro real: ${formatBRL(
      projection.realFutureValue
    )}`,
    `Taxa mensal equivalente: ${formatPercent(
      projection.monthlyRate
    )}`,
    `Taxa anual real: ${formatPercent(
      projection.realAnnualRate
    )}`,
    `Prazo: ${projection.years} anos (${projection.months} meses)`
  ].join("\n");

  return {
    answer,

    financialProjection: {
      initialCapital: Number(
        projection.initialCapital.toFixed(2)
      ),

      monthlyContribution: Number(
        projection.monthlyContribution.toFixed(2)
      ),

      years:
        projection.years,

      months:
        projection.months,

      annualRate: Number(
        projection.annualRate.toFixed(8)
      ),

      monthlyRate: Number(
        projection.monthlyRate.toFixed(8)
      ),

      inflationRate: Number(
        projection.inflationRate.toFixed(8)
      ),

      realAnnualRate: Number(
        projection.realAnnualRate.toFixed(8)
      ),

      futureValue: Number(
        projection.futureValue.toFixed(2)
      ),

      totalContributed: Number(
        projection.totalContributed.toFixed(2)
      ),

      investmentReturn: Number(
        projection.investmentReturn.toFixed(2)
      ),

      realFutureValue: Number(
        projection.realFutureValue.toFixed(2)
      )
    },

    methodology: {
      capitalization:
        "monthly",

      contributionTiming:
        "end-of-month",

      annualRateType:
        "effective",

      monthlyRateConversion:
        "(1 + annualRate)^(1/12) - 1",

      realValueMethod:
        "futureValue / (1 + inflationRate)^years"
    }
  };
}

/*
|--------------------------------------------------------------------------
| ORIGINAL PRIVATE DATASET LOGIC
|--------------------------------------------------------------------------
*/

function scoreRecord(
  record,
  query
) {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const text =
    record.toLowerCase();

  return terms.reduce(
    (sum, term) =>
      sum +
      (
        text.includes(term)
          ? 1
          : 0
      ),
    0
  );
}

function buildOriginalPrivateOutput(
  dataset,
  query,
  operation
) {
  const ranked =
    dataset.records
      .map((record) => ({
        record,

        score:
          scoreRecord(
            record,
            query
          )
      }))

      .sort(
        (a, b) =>
          b.score - a.score
      );

  const relevant =
    ranked.filter(
      (item) =>
        item.score > 0
    );

  const basis =
    relevant.length > 0
      ? relevant
      : ranked.slice(0, 2);

  const policy =
    buildPolicy(
      dataset,
      operation
    );

  const cohortMeetsPolicy =
    basis.length >=
    policy.minCohortSize;

  const joined =
    basis
      .map(
        (item) =>
          item.record
      )
      .join(" ");

  const themes =
    cohortMeetsPolicy

      ? Array.from(
          new Set(
            joined
              .toLowerCase()
              .split(
                /[^a-z0-9]+/
              )
              .filter(
                (word) =>
                  word.length > 6
              )
          )
        ).slice(0, 8)

      : [];

  const answer =
    !cohortMeetsPolicy

      ? `Private compute found ${basis.length} matching private records, below the minimum cohort threshold of ${policy.minCohortSize}.`

      : operation ===
          "risk-summary"

        ? `Private compute found ${basis.length} relevant private records. Dominant risk themes: ${
            themes.join(", ") ||
            "none"
          }.`

        : `Private compute completed over ${dataset.title}.`;

  return {
    answer,

    aggregate: {
      recordsEvaluated:
        dataset.records.length,

      relevantSignals:
        cohortMeetsPolicy
          ? basis.length
          : 0,

      dominantThemes:
        themes,

      confidence:
        cohortMeetsPolicy &&
        basis.some(
          (item) =>
            item.score > 1
        )
          ? "high"
          : "medium",

      minCohortSize:
        policy.minCohortSize,

      withheldForCohortPolicy:
        !cohortMeetsPolicy
    }
  };
}

/*
|--------------------------------------------------------------------------
| MAIN AGENT EXECUTION
|--------------------------------------------------------------------------
*/

export function runPrivateCompute({
  dataset,
  query,
  operation,
  auth,
  paymentReceipt,
  mission
}) {
  const policy =
    buildPolicy(
      dataset,
      operation
    );

  let output;

  if (
    operation ===
    "financial-projection"
  ) {
    output =
      buildFinancialOutput(
        query
      );
  } else {
    output =
      buildOriginalPrivateOutput(
        dataset,
        query,
        operation
      );
  }

  const receipt = {
    receiptId: id(
      "rcpt",
      {
        datasetId:
          dataset.id,

        query,

        operation,

        authCommitment:
          auth.authCommitment,

        paymentId:
          paymentReceipt.paymentId
      }
    ),

    datasetCommitment:
      datasetCommitment(
        dataset
      ),

    policyHash:
      sha256Hex(
        policy
      ),

    authCommitment:
      auth.authCommitment,

    scopeCommitment:
      auth.scopeCommitment,

    paymentContextDigest:
      paymentReceipt.authorizationDigest,

    missionId:
      mission?.missionId ??
      null,

    missionHash:
      mission?.missionHash ??
      null,

    missionCommitment:
      mission?.missionCommitment ??
      null,

    enforcementReceipts:
      mission?.enforcementReceipts ??
      [],

    outputHash:
      sha256Hex(
        output
      ),

    paymentReceipt,

    zekoAuditReceipt: {
      networkId:
        "zeko:sepolia",

      protocolNetworkId:
        "zeko:sepolia",

      graphqlNetworkId:
        "zeko:testnet",

      signingNetworkId:
        "testnet",

      primitive:
        "financial-projection-audit-receipt-v1",

      receiptCommitment:
        sha256Hex({
          datasetCommitment:
            datasetCommitment(
              dataset
            ),

          policyHash:
            sha256Hex(
              policy
            ),

          authCommitment:
            auth.authCommitment,

          missionHash:
            mission?.missionHash ??
            null,

          outputHash:
            sha256Hex(
              output
            ),

          paymentId:
            paymentReceipt.paymentId
        }),

      explorerHint:
        "https://zekoscan.io/testnet",

      mocked: true
    }
  };

  return {
    output,
    policy,
    receipt
  };
}