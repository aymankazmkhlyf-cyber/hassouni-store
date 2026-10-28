import { formAction } from "./client";
export const requestResetAction = formAction("password.requestReset");
export const resetWithCodeAction = formAction("password.resetWithCode");
export const requestChangeAction = formAction("password.requestChange");
export const changeWithCodeAction = formAction("password.changeWithCode");
