import { createAuth0Client } from "/vendor/auth0-spa-js.production.esm.js";

const state = {
  proof: null,
  agentPassport: null,
  missionApproval: null,
  rails: [],
  selectedRail: "zeko",
  lastRequirement: null,
  auth0: {
    client: null,
    config: null,
    user: null,
    commitment: null
  }
};

const $ = (id) => document.getElementById(id);

async function json(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const body = await res.json();
  return { res, body };
}

function renderRails() {
  $("rails").innerHTML = state.rails
    .map(
      (rail) => `
        <button class="rail ${rail.id === state.selectedRail ? "active" : ""}" data-rail="${rail.id}">
          <span>
            ${rail.chainName}${rail.preview ? " (preview)" : ""}
            <small>${rail.asset.symbol} Â· ${rail.network}</small>
          </span>
          <strong>${rail.displayAmount ?? rail.amount}</strong>
        </button>
      `
    )
    .join("");

  document.querySelectorAll(".rail").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRail = button.dataset.rail;
      renderRails();
    });
  });
}

function renderResult(payload) {
  const receipt = payload.receipt;
  const result = payload.result;

  $("result").className = "";

  if (result.financialProjection) {
    const fp = result.financialProjection;

    const money = (value) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
      }).format(value);

    const percent = (value) =>
      new Intl.NumberFormat("pt-BR", {
        style: "percent",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);

    $("result").innerHTML = `
      <div class="receipt">
        <div class="answer">
          <strong>Financial Projection Agent</strong><br><br>
          ProjeÃ§Ã£o concluÃ­da com sucesso.
        </div>

        <div class="metric">
          <strong>Capital inicial</strong>
          ${money(fp.initialCapital)}
        </div>

        <div class="metric">
          <strong>Aporte mensal</strong>
          ${money(fp.monthlyContribution)}
        </div>

        <div class="metric">
          <strong>Prazo</strong>
          ${fp.years} anos (${fp.months} meses)
        </div>

        <div class="metric">
          <strong>Taxa anual</strong>
          ${percent(fp.annualRate)}
        </div>

        <div class="metric">
          <strong>Taxa mensal equivalente</strong>
          ${percent(fp.monthlyRate)}
        </div>

        <div class="metric">
          <strong>InflaÃ§Ã£o anual</strong>
          ${percent(fp.inflationRate)}
        </div>

        <div class="metric">
          <strong>Taxa real anual</strong>
          ${percent(fp.realAnnualRate)}
        </div>

        <div class="metric">
          <strong>Total aportado</strong>
          ${money(fp.totalContributed)}
        </div>

        <div class="metric">
          <strong>Rendimento acumulado</strong>
          ${money(fp.investmentReturn)}
        </div>

        <div class="metric">
          <strong>PatrimÃ´nio futuro</strong>
          ${money(fp.futureValue)}
        </div>

        <div class="metric">
          <strong>PatrimÃ´nio futuro em valor real</strong>
          ${money(fp.realFutureValue)}
        </div>

        <div class="hashes">
          <div class="hash">
            <strong>Receipt</strong>
            ${receipt.receiptId}
          </div>

          <div class="hash">
            <strong>Dataset commitment</strong>
            ${receipt.datasetCommitment}
          </div>

          <div class="hash">
            <strong>Auth commitment</strong>
            ${receipt.authCommitment}
          </div>

          <div class="hash">
            <strong>Output hash</strong>
            ${receipt.outputHash}
          </div>

          <div class="hash">
            <strong>Payment</strong>
            ${receipt.paymentReceipt.railId} Â· ${receipt.paymentReceipt.txHash}
          </div>

          <div class="hash">
            <strong>Mission</strong>
            ${receipt.missionId ?? "demo"} Â· ${receipt.missionHash ?? ""}
          </div>

          <div class="hash">
            <strong>Zeko audit commitment</strong>
            ${receipt.zekoAuditReceipt.receiptCommitment}
          </div>
        </div>
      </div>
    `;

    return;
  }

  $("result").innerHTML = `
    <div class="receipt">
      <div class="answer">
        ${result.answer}
      </div>

      <div class="metric">
        <strong>Records evaluated</strong>
        ${result.aggregate?.recordsEvaluated ?? "-"}
      </div>

      <div class="metric">
        <strong>Relevant signals</strong>
        ${result.aggregate?.relevantSignals ?? "-"}
      </div>

      <div class="metric">
        <strong>Confidence</strong>
        ${result.aggregate?.confidence ?? "-"}
      </div>

      <div class="metric">
        <strong>Raw data released</strong>
        ${payload.rawDataReleased}
      </div>

      <div class="hashes">
        <div class="hash">
          <strong>Receipt</strong>
          ${receipt.receiptId}
        </div>

        <div class="hash">
          <strong>Output hash</strong>
          ${receipt.outputHash}
        </div>
      </div>
    </div>
  `;
}
function financialProofParams(fp) {
  const annualRatePpm =
    Math.round(fp.annualRate * 1_000_000);

  const monthlyRatePpm =
    Math.round(fp.monthlyRate * 1_000_000);

  return {
    initialCapital:
      fp.initialCapital,

    monthlyContribution:
      fp.monthlyContribution,

    annualRatePpm,

    monthlyRatePpm,

    months:
      fp.months
  };
}
function renderFinancialProofStatus(status, data = null) {
  const existing =
    document.getElementById("financial-proof-status");

  if (existing) {
    existing.remove();
  }

  const block =
    document.createElement("div");

  block.id =
    "financial-proof-status";

  block.className =
    "receipt";

  if (status === "loading") {
    block.innerHTML = `
      <div class="answer">
        <strong>Zero-Knowledge Verification</strong><br><br>

        <div id="zk-stage">
          1/4 - Preparando dados financeiros...
        </div>

        <br>

        <div>
          Tempo decorrido:
          <strong id="zk-timer">0s</strong>
        </div>

        <br>

        <small>
          A geraÃ§Ã£o das provas pode levar alguns minutos.
        </small>
      </div>
    `;
  }

  if (status === "success") {
    const seconds =
      data.generationTimeMs
        ? (data.generationTimeMs / 1000).toFixed(1)
        : "-";

    block.innerHTML = `
      <div class="answer">
        <strong>Zero-Knowledge Verification</strong><br><br>

        Ã¢Å“â€œ Financial calculation verified<br>
Ã¢Å“â€œ Financial ZK Proof valid<br>
Ã¢Å“â€œ Mission Compliance Proof valid<br>
Ã¢Å“â€œ Cryptographic proof linkage verified<br>
Ã¢Å“â€œ Meses verificados: ${data.monthsVerified}
      </div>f

      <div class="metric">
        <strong>Financial ZK Proof</strong>
        VALID
      </div>

      <div class="metric">
        <strong>Mission Compliance Proof</strong>
        VALID
      </div>

      <div class="metric">
        <strong>Proof linkage</strong>
        VERIFIED
      </div>

      <div class="metric">
        <strong>Meses verificados</strong>
        ${data.monthsVerified}
      </div>

      <div class="metric">
        <strong>Tempo de geraÃ§Ã£o</strong>
        ${seconds} segundos
      </div>

      <button
        id="toggle-proof-details"
        type="button"
        style="margin-top:16px"
      >
        Ver detalhes tÃ©cnicos
      </button>

      <div
        id="proof-details"
        class="hashes"
        style="display:none; margin-top:12px"
      >
        <div class="hash">
          <strong>Financial input commitment</strong>
          ${data.financialInputCommitment}
        </div>

        <div class="hash">
          <strong>Financial output commitment</strong>
          ${data.financialOutputCommitment}
        </div>

        <div class="hash">
          <strong>Financial proof commitment</strong>
          ${data.financialProofCommitment}
        </div>

        <div class="hash">
          <strong>Verification key hash</strong>
          ${data.financialVerificationKeyHash}
        </div>
      </div>
    `;

    setTimeout(() => {
      const button =
        document.getElementById("toggle-proof-details");

      const details =
        document.getElementById("proof-details");

      if (!button || !details) return;

      button.addEventListener("click", () => {
        const hidden =
          details.style.display === "none";

        details.style.display =
          hidden ? "block" : "none";

        button.textContent =
          hidden
            ? "Ocultar detalhes tÃ©cnicos"
            : "Ver detalhes tÃ©cnicos";
      });
    }, 0);
  }

  if (status === "error") {
    block.innerHTML = `
      <div class="answer">
        <strong>Zero-Knowledge Verification</strong><br><br>

        NÃ£o foi possÃ­vel gerar a prova ZK.

        <br><br>

        <small>
          ${data?.message ?? data?.error ?? "Erro desconhecido"}
        </small>
      </div>
    `;
  }

  $("result").appendChild(block);
}

async function init() {
  const health = await json("/api/health").catch(() => null);

  $("health").textContent = health?.body?.ok ? "online" : "offline";
  $("health").className = `health ${health?.body?.ok ? "ok" : "bad"}`;

  const [{ body: railsBody }, { body: datasetsBody }] = await Promise.all([
    json("/api/rails"),
    json("/api/datasets")
  ]);

  state.rails = railsBody.rails;

  if (!state.rails.some((rail) => rail.id === state.selectedRail)) {
    state.selectedRail = state.rails[0]?.id ?? "zeko";
  }

  renderRails();

  $("dataset").innerHTML = datasetsBody.datasets
    .map(
      (dataset) =>
        `<option value="${dataset.id}">${dataset.title} Â· ${dataset.classification}</option>`
    )
    .join("");

  $("operation").innerHTML = `
    <option value="financial-projection">
      Financial Projection
    </option>
  `;

  $("operation").value = "financial-projection";

  $("query").value = `capital inicial: 100000
aporte mensal: 2000
taxa anual: 8
anos: 10
inflaÃ§Ã£o: 4`;

  await initAuth0();
}

async function initAuth0() {
  try {
    const { body: config } = await json("/api/oauth/browser-config");

    state.auth0.config = config;

    if (!config.configured) {
      $("auth0Status").textContent = "Add Auth0 env vars";
      $("auth0Status").className = "status pending";

      $("auth0Profile").innerHTML = `
        <div class="hint">
          Set <strong>AUTH0_DOMAIN</strong> and <strong>AUTH0_CLIENT_ID</strong> in .env.local.
        </div>
      `;

      $("auth0Login").disabled = true;
      return;
    }

    state.auth0.client = await createAuth0Client({
      domain: config.domain,
      clientId: config.clientId,
      cacheLocation: "localstorage",
      useRefreshTokens: true,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: config.audience || undefined,
        scope:
          "openid profile email compute:clinical dataset:clinical-failures-q1 rail:zeko rail:base budget:small"
      }
    });

    if (
      window.location.search.includes("code=") &&
      window.location.search.includes("state=")
    ) {
      await state.auth0.client.handleRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    await updateAuth0Ui();
  } catch (error) {
    $("auth0Status").textContent = "Auth0 error";
    $("auth0Status").className = "status bad";

    $("auth0Profile").textContent =
      error instanceof Error ? error.message : String(error);
  }
}

async function updateAuth0Ui() {
  const isAuthenticated = await state.auth0.client.isAuthenticated();

  $("auth0Login").hidden = isAuthenticated;
  $("auth0Logout").hidden = !isAuthenticated;

  if (!isAuthenticated) {
    $("auth0Status").textContent = "Ready";
    $("auth0Status").className = "status pending";

    $("auth0Profile").innerHTML = `
      <div class="hint">
        Auth0 SPA login is configured.
      </div>
    `;

    return;
  }

  const user = await state.auth0.client.getUser();

  state.auth0.user = user;

  $("auth0Status").textContent = "Authenticated";
  $("auth0Status").className = "status ok";

  $("auth0Profile").innerHTML = `
    <div class="auth0-user">
      <img src="${user.picture ?? ""}" alt="" />

      <div>
        <strong>${user.name ?? user.email ?? user.sub}</strong>
        <span>${user.email ?? user.sub}</span>
      </div>
    </div>
  `;

  await commitAuth0Token();
}

async function commitAuth0Token() {
  const config = state.auth0.config;

  let token;
  let audience;

  try {
    if (config.audience) {
      token = await state.auth0.client.getTokenSilently({
        authorizationParams: {
          audience: config.audience,
          scope:
            "openid profile email compute:clinical dataset:clinical-failures-q1 rail:zeko rail:base budget:small"
        }
      });

      audience = config.audience;
    } else {
      const claims = await state.auth0.client.getIdTokenClaims();

      token = claims?.__raw;
      audience = config.clientId;
    }

    if (!token) return;

    const { body, res } = await json("/api/oauth/zk-commit", {
      method: "POST",
      body: JSON.stringify({
        provider: "auth0-spa",
        token,
        issuer: config.issuer,
        audience,
        jwksUrl: `${config.issuer}.well-known/jwks.json`,
        salt: "auth0-spa-local-salt"
      })
    });

    if (!res.ok) {
      throw new Error(body.message ?? body.error ?? "commit failed");
    }

    state.auth0.commitment = body;

    $("auth0Profile").insertAdjacentHTML(
      "beforeend",
      `
        <div class="commitment">
          <strong>Auth commitment</strong>
          <span>${body.authCommitment}</span>
        </div>
      `
    );
  } catch (error) {
    $("auth0Profile").insertAdjacentHTML(
      "beforeend",
      `
        <div class="hint warn">
          Authenticated, but token commitment failed:
          ${error instanceof Error ? error.message : String(error)}
        </div>
      `
    );
  }
}

$("issueProof").addEventListener("click", async () => {
  const { body } = await json("/api/oauth/zk-issue", {
    method: "POST",
    body: JSON.stringify({})
  });

  state.proof = body.zkOAuthProof;

  const passport = await json("/api/agents/passport", {
    method: "POST",
    body: JSON.stringify({
      agentId: state.proof.revealed.agentId,
      organization: state.proof.revealed.organization
    })
  });

  state.agentPassport = passport.body.agentPassport;

  $("agentStatus").textContent = `${state.proof.revealed.agentId} verified`;
  $("agentStatus").className = "status ok";
});

$("auth0Login").addEventListener("click", async () => {
  if (!state.auth0.client) return;

  await state.auth0.client.loginWithRedirect({
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: state.auth0.config.audience || undefined,
      scope:
        "openid profile email compute:clinical dataset:clinical-failures-q1 rail:zeko rail:base budget:small"
    }
  });
});

$("auth0Logout").addEventListener("click", async () => {
  if (!state.auth0.client) return;

  await state.auth0.client.logout({
    logoutParams: {
      returnTo: window.location.origin
    }
  });
});

$("computeForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!state.proof) {
    $("agentStatus").textContent = "Issue proof first";
    $("agentStatus").className = "status bad";
    return;
  }

  const requestBody = {
    datasetId: $("dataset").value,
    operation: $("operation").value,
    query: $("query").value,
    zkOAuthProof: state.proof
  };

  const mission = await json("/api/missions/propose", {
    method: "POST",
    body: JSON.stringify({
      agentId: state.proof.revealed.agentId,
      datasetId: requestBody.datasetId,
      operation: requestBody.operation,
      task: requestBody.query,
      title: "Financial Projection",
      allowedScopes: [
        `compute:${requestBody.datasetId.split("-")[0]}`,
        `dataset:${requestBody.datasetId}`,
        "x402:pay"
      ],
      allowedRails: ["zeko", "ethereum", "base", "arc", "tempo"]
    })
  });

  const approval = await json("/api/missions/approve", {
    method: "POST",
    body: JSON.stringify({
      missionId: mission.body.mission.missionId,
      approverId: "enterprise-policy@example.com",
      issuer: "demo-enterprise-sso"
    })
  });

  state.missionApproval = approval.body.approval;
  requestBody.missionApproval = state.missionApproval;

  const first = await json("/api/compute", {
    method: "POST",
    body: JSON.stringify(requestBody)
  });

  state.lastRequirement = first.body.requirement;
  $("offer").textContent = JSON.stringify(first.body.requirement, null, 2);

  const payment = await json("/api/payments/mock-authorize", {
    method: "POST",
    body: JSON.stringify({
      requirement: state.lastRequirement,
      railId: state.selectedRail,
      payer: state.proof.revealed.agentId
    })
  });

  const paid = await json("/api/compute", {
  method: "POST",
  headers: {
    "PAYMENT-SIGNATURE": payment.body.paymentHeader
  },
  body: JSON.stringify(requestBody)
});

renderResult(paid.body);

const fp =
  paid.body.result?.financialProjection;

if (fp) {
  const submitButton =
    $("computeForm").querySelector(
      'button[type="submit"]'
    );

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent =
      "Generating ZK Proofs...";
  }

  renderFinancialProofStatus("loading");

  let elapsedSeconds = 0;

  const timer =
    setInterval(() => {
      elapsedSeconds += 1;

      const timerElement =
        document.getElementById("zk-timer");

      if (timerElement) {
        timerElement.textContent =
          `${elapsedSeconds}s`;
      }

      const stageElement =
        document.getElementById("zk-stage");

      if (stageElement) {
        if (elapsedSeconds < 20) {
          stageElement.textContent =
            "1/4 - Preparando dados financeiros...";
        } else if (elapsedSeconds < 120) {
          stageElement.textContent =
            "2/4 - Gerando Financial ZK Proof...";
        } else if (elapsedSeconds < 220) {
          stageElement.textContent =
            "3/4 - Gerando Mission Compliance Proof...";
        } else {
          stageElement.textContent =
            "4/4 - Verificando vÃ­nculo criptogrÃ¡fico...";
        }
      }
    }, 1000);


   try {
    const proofRequest =
      financialProofParams(fp);

    const {
      body: proofBody,
      res: proofResponse
    } =
      await json(
        "/api/financial-proof",
        {
          method: "POST",
          body: JSON.stringify(proofRequest)
        }
      );

    clearInterval(timer);

    if (!proofResponse.ok) {
      throw new Error(
        proofBody.message ??
        proofBody.error ??
        "Financial proof failed"
      );
    }

    renderFinancialProofStatus(
      "success",
      proofBody
    );

  } catch (error) {
    clearInterval(timer);

    renderFinancialProofStatus(
      "error",
      {
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    );

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        "Run Financial Projection";
    }
  }
}
});

init();
