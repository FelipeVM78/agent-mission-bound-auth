import "reflect-metadata";

import {
  Bool,
  Field,
  MerkleMap,
  Poseidon,
  PrivateKey,
  Signature,
  UInt32,
  UInt64
} from "o1js";

import {
  FinancialProjectionProgram,
  FinancialProjectionPublicInput,
  FinancialProjectionWitness
} from "../dist-zkapp/FinancialProjectionProgram.js";

import {
  MAX_MISSION_EVENTS,
  MissionBoundaryEventWitness,
  MissionComplianceProgram,
  MissionCompliancePublicInput,
  MissionComplianceWitness,
  domainProofAttestationMessage,
  missionApprovalCommitment,
  missionBoundaryEventHash,
  missionCapabilityCommitment,
  missionPolicyCommitment,
  missionReceiptCommitment
} from "../dist-zkapp/MissionComplianceProgram.js";

/* =========================================================
   1. CÃLCULO FINANCEIRO
   ========================================================= */

const initialCapitalCents =
  BigInt(process.env.FIN_INITIAL_CAPITAL_CENTS ?? "10000000");

const monthlyContributionCents =
  BigInt(process.env.FIN_MONTHLY_CONTRIBUTION_CENTS ?? "200000");

  const annualRatePpm =
  BigInt(process.env.FIN_ANNUAL_RATE_PPM ?? "80000");

const monthlyRatePpm =
  BigInt(process.env.FIN_MONTHLY_RATE_PPM ?? "6434");

const months =
  BigInt(process.env.FIN_MONTHS ?? "120");

const SCALE = 1_000_000n;

const MAX_MONTHS = 360n;

if (
  months < 1n ||
  months > MAX_MONTHS
) {
  throw new Error(
    "O circuito suporta prazos entre 1 e 360 meses."
  );
}

let balance =
  initialCapitalCents;

const balances = [
  balance
];

const interests = [];
const remainders = [];

/*
 * Meses efetivamente solicitados.
 */
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

  interests.push(
    interest
  );

  remainders.push(
    remainder
  );

  balance =
    balance +
    interest +
    monthlyContributionCents;

  balances.push(
    balance
  );
}

/*
 * Este Ã© o saldo final correspondente
 * ao prazo solicitado.
 */
const finalBalanceCents =
  balance;

/*
 * O circuito possui capacidade fixa
 * para atÃ© 360 meses.
 *
 * Depois do prazo solicitado:
 * - saldo fica constante;
 * - juros = 0;
 * - remainder = 0.
 */
while (
  interests.length < Number(MAX_MONTHS)
) {
  interests.push(
    0n
  );

  remainders.push(
    0n
  );

  balances.push(
    balance
  );
}

/* =========================================================
   2. PROVA ZK FINANCEIRA
   ========================================================= */

const financialInput =
  new FinancialProjectionPublicInput({
    initialCapitalCents:
      UInt64.from(initialCapitalCents),

    monthlyContributionCents:
      UInt64.from(monthlyContributionCents),

      annualRatePpm:
  UInt64.from(annualRatePpm),

    monthlyRatePpm:
      UInt64.from(monthlyRatePpm),

    months:
      UInt64.from(months),

    expectedFutureValueCents:
      UInt64.from(finalBalanceCents)
  });

const financialWitness =
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
console.log(
  "1/4 - Compilando circuito financeiro..."
);

const {
  verificationKey:
    financialVerificationKey
} =
  await FinancialProjectionProgram.compile();

console.log(
  "2/4 - Gerando FinancialProjectionProof..."
);

const {
  proof: financialProof
} =
  await FinancialProjectionProgram.proveProjection(
    financialInput,
    financialWitness
  );

const financialProofValid =
  await FinancialProjectionProgram.verify(
    financialProof
  );

if (!financialProofValid) {
  throw new Error(
    "FinancialProjectionProof invÃ¡lida."
  );
}

console.log(
  "FinancialProjectionProof: VALID"
);

/* =========================================================
   3. COMMITMENTS FINANCEIROS
   ========================================================= */

const financialInputCommitment =
  Poseidon.hash([
    Field(initialCapitalCents),
    Field(monthlyContributionCents),
    Field(annualRatePpm),
    Field(monthlyRatePpm),
    Field(months)
  ]);

const financialOutputCommitment =
  Poseidon.hash([
    Field(finalBalanceCents)
  ]);

const financialProofCommitment =
  Poseidon.hash([
    financialInputCommitment,
    financialOutputCommitment,
    financialVerificationKey.hash
  ]);

console.log("");
console.log(
  "Financial proof commitment:"
);

console.log(
  financialProofCommitment.toString()
);

/* =========================================================
   4. CONFIGURAÃ‡ÃƒO DA MISSÃƒO
   ========================================================= */

MissionComplianceProgram.setProofsEnabled(
  true
);

const holderKey =
  PrivateKey.random();

const holderPublicKey =
  holderKey.toPublicKey();

const domainVerifierKey =
  PrivateKey.random();

const domainVerifierPublicKey =
  domainVerifierKey.toPublicKey();

const beneficiary =
  PrivateKey.random().toPublicKey();

const actionMap =
  new MerkleMap();

const domainMap =
  new MerkleMap();

const actionKey =
  Field(101);

const domainKey =
  Field(201);

actionMap.set(
  actionKey,
  Field(1)
);

domainMap.set(
  domainKey,
  Field(1)
);

/* =========================================================
   5. INPUT PÃšBLICO DA MISSÃƒO
   ========================================================= */

const input =
  new MissionCompliancePublicInput({
    missionIdHash:
      Field(11),

    authCommitment:
      Field(12),

    capabilityCommitment:
      Field(0),

    policyCommitment:
      Field(0),

    approvalCommitment:
      Field(0),

    holderKeyCommitment:
      Poseidon.hash(
        holderPublicKey.toFields()
      ),

    domainVerifierKeyCommitment:
      Poseidon.hash(
        domainVerifierPublicKey.toFields()
      ),

    allowedActionsRoot:
      actionMap.getRoot(),

    allowedDomainsRoot:
      domainMap.getRoot(),

    datasetCommitment:
      financialInputCommitment,

    domainProofCommitment:
      financialProofCommitment,

    outputCommitment:
      financialOutputCommitment,

    paymentContextDigest:
      Field(0),

    traceRoot:
      Field(0),

    receiptCommitment:
      Field(0),

    nullifier:
      Field(0),

    validUntilSlot:
      UInt32.from(500),

    lastObservedSlot:
      UInt32.zero,

    maxSpendMicrousd:
      UInt64.from(
        2_000_000
      ),

    totalSpendMicrousd:
      UInt64.zero,

    eventCount:
      UInt32.zero,

    beneficiary,

    payoutNanomina:
      UInt64.from(
        15_000_000
      ),

    protocolFeeNanomina:
      UInt64.from(
        1_000_000
      )
  });
const privateValues = {
  principalCommitment:
    Field(21),

  agentCommitment:
    Field(22),

  capabilityNonce:
    Field(23),

  policyNonce:
    Field(24),

  nullifierSecret:
    Field(25),

  receiptNonce:
    Field(26)
};

input.policyCommitment =
  missionPolicyCommitment(
    input,
    privateValues.policyNonce
  );

input.capabilityCommitment =
  missionCapabilityCommitment(
    input,
    privateValues.principalCommitment,
    privateValues.agentCommitment,
    privateValues.capabilityNonce
  );

input.approvalCommitment =
  missionApprovalCommitment(
    input
  );

input.nullifier =
  Poseidon.hash([
    input.capabilityCommitment,
    input.missionIdHash,
    privateValues.nullifierSecret
  ]);
/* =========================================================
   6. EVENTO DA MISSÃƒO
   ========================================================= */

const unsignedEvent =
  new MissionBoundaryEventWitness({
    enabled:
      Bool(true),

    actionKey,

    domainKey,

    resourceCommitment:
      financialProofCommitment,

    paymentContextDigest:
      Field(401),

    spendMicrousd:
      UInt64.from(1000),

    observedSlot:
      UInt32.from(100),

    eventNonce:
      Field(501),

    holderSignature:
      Signature.create(
        holderKey,
        [Field(0)]
      ),

    actionWitness:
      actionMap.getWitness(
        actionKey
      ),

    domainWitness:
      domainMap.getWitness(
        domainKey
      )
  });

const eventHash =
  missionBoundaryEventHash(
    input,
    Field(0),
    unsignedEvent
  );

const event =
  new MissionBoundaryEventWitness({
    enabled:
      Bool(true),

    actionKey,

    domainKey,

    resourceCommitment:
      financialProofCommitment,

    paymentContextDigest:
      Field(401),

    spendMicrousd:
      UInt64.from(1000),

    observedSlot:
      UInt32.from(100),

    eventNonce:
      Field(501),

    holderSignature:
      Signature.create(
        holderKey,
        [eventHash]
      ),

    actionWitness:
      actionMap.getWitness(
        actionKey
      ),

    domainWitness:
      domainMap.getWitness(
        domainKey
      )
  });

const events =
  [event];

const dummyKey =
  PrivateKey.random();

while (
  events.length <
  MAX_MISSION_EVENTS
) {
  events.push(
    new MissionBoundaryEventWitness({
      enabled:
        Bool(false),

      actionKey:
        Field(0),

      domainKey:
        Field(0),

      resourceCommitment:
        Field(0),

      paymentContextDigest:
        Field(0),

      spendMicrousd:
        UInt64.zero,

      observedSlot:
        UInt32.zero,

      eventNonce:
        Field(0),

      holderSignature:
        Signature.create(
          dummyKey,
          [Field(0)]
        ),

      actionWitness:
        actionMap.getWitness(
          Field(0)
        ),

      domainWitness:
        domainMap.getWitness(
          Field(0)
        )
    })
  );
}

/* =========================================================
   7. TRACE / SPEND / RECEIPT
   ========================================================= */

input.traceRoot =
  Poseidon.hash([
    Field(0),
    eventHash
  ]);

input.paymentContextDigest =
  Field(401);

input.totalSpendMicrousd =
  UInt64.from(1000);

input.eventCount =
  UInt32.from(1);

input.lastObservedSlot =
  UInt32.from(100);

const receiptNonce =
  Field(26);

input.receiptCommitment =
  missionReceiptCommitment(
    input,
    receiptNonce
  );

/* =========================================================
   8. DOMAIN VERIFIER
   ========================================================= */

const domainProofSignature =
  Signature.create(
    domainVerifierKey,
    [
      domainProofAttestationMessage(
        input
      )
    ]
  );

/* =========================================================
   9. WITNESS DA MISSÃƒO
   ========================================================= */

const missionWitness =
  new MissionComplianceWitness({
    principalCommitment:
      Field(21),

    agentCommitment:
      Field(22),

    capabilityNonce:
      Field(23),

    policyNonce:
      Field(24),

    nullifierSecret:
      Field(25),

    receiptNonce,

    holderPublicKey,

    domainVerifierPublicKey,

    domainProofSignature,

    events
  });

/* =========================================================
   10. MISSION COMPLIANCE PROOF
   ========================================================= */

console.log("");
console.log(
  "3/4 - Compilando MissionComplianceProgram..."
);

await MissionComplianceProgram.compile();

console.log(
  "4/4 - Gerando MissionComplianceProof..."
);

const {
  proof: missionProof
} =
  await MissionComplianceProgram.proveCompliance(
    input,
    missionWitness
  );

const missionProofValid =
  await MissionComplianceProgram.verify(
    missionProof
  );

if (!missionProofValid) {
  throw new Error(
    "MissionComplianceProof invÃ¡lida."
  );
}

/* =========================================================
   11. RESULTADO
   ========================================================= */

const linked =
  input.domainProofCommitment
    .equals(
      financialProofCommitment
    )
    .toBoolean();

console.log("");
console.log(
  "================================================"
);

console.log(
  "FINANCIAL AGENT COMPOSED ZK PROOFS: VALID"
);

console.log(
  "================================================"
);

console.log("");

console.log(
  JSON.stringify(
    {
      ok: true,

      financialProofVerified:
        financialProofValid,

      missionProofVerified:
        missionProofValid,

      monthsVerified:
  Number(months),

      initialCapital:
  Number(initialCapitalCents) / 100,

monthlyContribution:
  Number(monthlyContributionCents) / 100,

monthlyRatePercent:
  Number(monthlyRatePpm) / 10_000,

finalBalance:
  Number(finalBalanceCents) / 100,

      financialInputCommitment:
        financialInputCommitment
          .toString(),

      financialOutputCommitment:
        financialOutputCommitment
          .toString(),

      financialProofCommitment:
        financialProofCommitment
          .toString(),

      missionDatasetCommitment:
        input.datasetCommitment
          .toString(),

      missionOutputCommitment:
        input.outputCommitment
          .toString(),

      missionDomainProofCommitment:
        input.domainProofCommitment
          .toString(),

      linked,

      financialVerificationKeyHash:
        financialVerificationKey.hash
          .toString()
    },
    null,
    2
  )
);
