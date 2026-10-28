import { formAction, jsonAction } from "./client";
export const trackOrderAction = formAction("orders.track");
export const submitProofAction = formAction("orders.submitProof");
export const openOrdersAction = jsonAction<{ inProgress: string[] }>("orders.open");
