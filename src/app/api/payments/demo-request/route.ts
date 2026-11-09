import { createPaidRequestEndpoint } from "@/lib/payments/endpoint";
import { handleContract } from "@/lib/server/handlers";

export const POST = createPaidRequestEndpoint(handleContract);
