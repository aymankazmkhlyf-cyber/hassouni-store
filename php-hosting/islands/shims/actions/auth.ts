import { formAction } from "./client";
export const loginAction = formAction("auth.login");
export const adminLoginAction = formAction("auth.adminLogin");
export const registerAction = formAction("auth.register");
export const deleteOwnAccountAction = formAction("auth.deleteOwnAccount");
