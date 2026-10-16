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

import {
  buildMissionComplianceProofArtifact,
  verifyMissionComplianceProofArtifact
} from "../dist-zkapp/mission-proof-artifact.js";

/* =========================================================
   1. DADOS FINANCEIROS
   ========================================================= */

const financialInput = {
  initialCapitalCents: 10_000_000,
  monthlyContributionCents: 200_000,
  annualRateBasisPoints: 800,
  inflationRateBasisPoints: 400,
  years: 10
};

const financialOutput = {
  futureValueCents: 57_614_105,
  totalContributedCents: 34_000_000,
  investmentReturnCents: 23_614_105,
  realFutureValueCents: 38_922_025
};

/* =========================================================
   2. COMMITMENTS FINANCEIROS
   ========================================================= */

const financialInputCommitment =
  Poseidon.hash([
    Field(financialInput.initialCapitalCents),
    Field(financialInput.monthlyContributionCents),
    Field(financialInput.annualRateBasisPoints),
    Field(financialInput.inflationRateBasisPoints),
    Field(financialInput.years)
  ]);

const financialOutputCommitment =
  Poseidon.hash([
    Field(financialOutput.futureValueCents),
    Field(financialOutput.totalContributedCents),
    Field(financialOutput.investmentReturnCents),
    Field(financialOutput.realFutureValueCents)
  ]);

console.log("");
console.log("FINANCIAL INPUT COMMITMENT:");
console.log(financialInputCommitment.toString());

console.log("");
console.log("FINANCIAL OUTPUT COMMITMENT:");
console.log(financialOutputCommitment.toString());

/* =========================================================
   3. CHAVES
   ========================================================= */

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

/* =========================================================
   4. MERKLE MAPS
   ========================================================= */

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
   5. PRIVATE VALUES
   ========================================================= */

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

/* =========================================================
   6. PUBLIC INPUT DA MISSÃO
   ========================================================= */

const input =
  new MissionCompliancePublicInput({
    missionIdHash:
      Poseidon.hash([
        Field(20261007),
        Field(1)
      ]),

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
      financialOutputCommitment,

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

/* =========================================================
   7. POLICY / CAPABILITY / APPROVAL
   ========================================================= */

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
   8. EVENTO
   ========================================================= */

const unsignedEvent =
  new MissionBoundaryEventWitness({
    enabled:
      Bool(true),

    actionKey,

    domainKey,

    resourceCommitment:
      financialOutputCommitment,

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
      financialOutputCommitment,

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

/* =========================================================
   9. COMPLETA ARRAY DE EVENTS
   ========================================================= */

const events = [event];

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
   10. TRACE / PAYMENT / SPEND
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

/* =========================================================
   11. RECEIPT
   ========================================================= */

input.receiptCommitment =
  missionReceiptCommitment(
    input,
    privateValues.receiptNonce
  );

/* =========================================================
   12. DOMAIN ATTESTATION
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
   13. WITNESS
   ========================================================= */

const witness =
  new MissionComplianceWitness({
    ...privateValues,

    holderPublicKey,

    domainVerifierPublicKey,

    domainProofSignature,

    events
  });

/* =========================================================
   14. COMPILA E PROVA
   ========================================================= */

MissionComplianceProgram.setProofsEnabled(
  true
);

console.log("");
console.log(
  "Compilando MissionComplianceProgram..."
);

const {
  verificationKey
} =
  await MissionComplianceProgram.compile();

console.log(
  "Circuito compilado."
);

console.log(
  "Gerando prova ZK real..."
);

const {
  proof
} =
  await MissionComplianceProgram.proveCompliance(
    input,
    witness
  );

const proofVerified =
  await MissionComplianceProgram.verify(
    proof
  );

if (!proofVerified) {
  throw new Error(
    "MissionComplianceProof inválida."
  );
}

console.log(
  "Prova ZK verificada."
);

/* =========================================================
   15. ARTIFACT
   ========================================================= */

const proofArtifact =
  buildMissionComplianceProofArtifact({
    proof,
    publicInput:
      input,

    verificationKey
  });

const serializedArtifactVerified =
  await verifyMissionComplianceProofArtifact(
    proofArtifact
  );

if (!serializedArtifactVerified) {
  throw new Error(
    "Artifact serializado inválido."
  );
}

/* =========================================================
   16. RESULTADO
   ========================================================= */

console.log("");
console.log(
  "FINANCIAL PROJECTION ZK PROOF: VALID"
);

console.log("");

console.log(
  JSON.stringify(
    {
      ok: true,

      proofsEnabled:
        true,

      financialInputs: {
        initialCapital:
          "R$ 100.000,00",

        monthlyContribution:
          "R$ 2.000,00",

        annualRate:
          "8%",

        inflation:
          "4%",

        years:
          10
      },

      financialOutputs: {
        futureValue:
          "R$ 576.141,05",

        totalContributed:
          "R$ 340.000,00",

        investmentReturn:
          "R$ 236.141,05",

        realFutureValue:
          "R$ 389.220,25"
      },

      financialInputCommitment:
        financialInputCommitment
          .toString(),

      financialOutputCommitment:
        financialOutputCommitment
          .toString(),

      proofArtifactHash:
        proofArtifact.artifactHash,

      circuitDigest:
        proofArtifact.circuitDigest,

      proofVerified,

      serializedArtifactVerified
    },
    null,
    2
  )
);