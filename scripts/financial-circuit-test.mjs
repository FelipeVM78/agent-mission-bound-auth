const initialCapitalCents = 10_000_000n;
const contributionCents = 200_000n;

// 6434 = 0,6434% ao mês
const monthlyRatePpm = 6434n;

const SCALE = 1_000_000n;

let balance = initialCapitalCents;

const balances = [balance];
const interests = [];
const remainders = [];

for (let month = 1; month <= 120; month += 1) {
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

console.log("RESUMO");

console.log({
  months: 120,
  finalBalanceCents: balance.toString(),
  finalBalanceBRL: Number(balance) / 100,
  numberOfBalances: balances.length,
  numberOfInterests: interests.length,
  numberOfRemainders: remainders.length
});

console.log("\nPRIMEIROS 5 JUROS:");

console.log(
  interests
    .slice(0, 5)
    .map(String)
);

console.log("\nPRIMEIROS 5 RESTOS:");

console.log(
  remainders
    .slice(0, 5)
    .map(String)
);