import { readBalances } from "../../src/lib/payments/wallet";
console.log(JSON.stringify(await readBalances(), null, 2));
