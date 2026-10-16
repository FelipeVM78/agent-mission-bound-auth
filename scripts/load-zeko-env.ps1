$deployer = Get-Content `
  "data\keys\deployer-zeko-sepolia-key.json" |
  ConvertFrom-Json

$registry = Get-Content `
  "data\keys\mission-registry-zeko-sepolia-key.json" |
  ConvertFrom-Json

$authority = Get-Content `
  "data\keys\mission-authority-zeko-sepolia-key.json" |
  ConvertFrom-Json

if (-not $deployer.privateKey) {
  throw "Private key do deployer não encontrada."
}

if (-not $registry.privateKey) {
  throw "Private key do MissionRegistry não encontrada."
}

if (-not $authority.privateKey) {
  throw "Private key da Mission Authority não encontrada."
}

# Profile
$env:DEMO_MODE = "false"
$env:MISSION_AUTH_PROFILE = "production"
$env:MISSION_SETTLEMENT_PROFILE = "zeko"

# Zeko Sepolia
$env:ZEKO_GRAPHQL = "https://sepolia.zeko.io/graphql"
$env:ZEKO_ARCHIVE = "https://sepolia.zeko.io/graphql"
$env:ZEKO_PROTOCOL_NETWORK_ID = "zeko:sepolia"
$env:ZEKO_NETWORK_ID = "testnet"
$env:ZEKO_NETWORK_NAME = "Zeko Ethereum Sepolia"
$env:ZEKO_NATIVE_ASSET = "sETH"
$env:ZEKO_NATIVE_DECIMALS = "9"
$env:ZEKO_NATIVE_TOKEN_ID = "wSHV2S4qX9jFsLjQo8r1BsMLH2ZRKsZx6EJd1sbozGPieEC4Jf"
$env:TX_FEE = "200000"

# Deployer
$env:DEPLOYER_PRIVATE_KEY = $deployer.privateKey
$env:DEPLOYER_PUBLIC_KEY = $deployer.publicKey

# MissionRegistry zkApp
$env:ZKAPP_PRIVATE_KEY = $registry.privateKey
$env:MISSION_REGISTRY_PUBLIC_KEY = $registry.publicKey
$env:MISSION_REGISTRY_STATE_PATH = Join-Path $PWD "data\mission-registry-state.zeko-sepolia.json"

# Mission Authority
$env:MISSION_AUTHORITY_ZEKO_PRIVATE_KEY = $authority.privateKey
$env:MISSION_AUTHORITY_ZEKO_PUBLIC_KEY = $authority.publicKey

# Para nosso teste, o próprio deployer recebe fees/benefícios.
$env:MISSION_PROTOCOL_FEE_RECIPIENT = $deployer.publicKey
$env:PRIVATE_COMPUTE_BENEFICIARY_PUBLIC_KEY = $deployer.publicKey

$env:ZEKO_PAY_TO = $deployer.publicKey
$env:ZEKO_BENEFICIARY = $deployer.publicKey

Write-Host ""
Write-Host "Zeko environment loaded."
Write-Host ""
Write-Host "Deployer:"
Write-Host $deployer.publicKey
Write-Host ""
Write-Host "MissionRegistry:"
Write-Host $registry.publicKey
Write-Host ""
Write-Host "Mission Authority:"
Write-Host $authority.publicKey
Write-Host ""
Write-Host "Private keys carregadas somente na sessão atual do PowerShell."