/*
 * Interactive parts of the PHP site. PHP renders <div data-island="Name"
 * data-props="{…}">fallback</div>; this script mounts the original React
 * component there with those props.
 */
import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";
import { CartButton, LanguageSwitcher, MobileMenu, ThemeToggle } from "@/components/store/header-widgets";
import { AddToCart } from "@/components/store/add-to-cart";
import { CartView } from "@/components/store/cart-view";
import { CheckoutForm } from "@/components/store/checkout-form";
import { CustomRequestForm, DeleteAccountForm, LoginForm, RegisterForm, TrackForm } from "@/components/store/forms";
import { OrderNotify } from "@/components/store/order-notify";
import { PaymentProofForm } from "@/components/store/payment-proof-form";
import { ReviewForm } from "@/components/store/review-form";
import { RememberOrder } from "@/components/store/recent-orders";
import { ReorderButton } from "@/components/store/reorder-button";
import { SupportWidget } from "@/components/store/support-widget";
import { InstallAppButton, InstallPrompt, ServiceWorkerRegister } from "@/components/store/pwa";
import { SetUsernameForm, TopupForm } from "@/components/store/wallet-forms";
import { CopyButton } from "@/components/ui/copy-button";
import { AdminNav } from "@/components/admin/admin-nav";
import { ChangePasswordForm, ForgotPasswordForm } from "@/components/admin/password-forms";
import { BrowserNotifyButton, SupportNotifier } from "@/components/admin/support-notifier";
import { SupportThreadView } from "@/components/admin/support-thread";
import { TelegramLink } from "@/components/admin/telegram-link";
import { initActionForms } from "./action-forms";

type Props = Record<string, unknown>;

/** Server-rendered HTML passed as a prop (e.g. the contact icons in the mobile menu). */
const Html = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />;

const registry: Record<string, ComponentType<Props>> = {
  CartButton: CartButton as ComponentType<Props>,
  LanguageSwitcher: LanguageSwitcher as ComponentType<Props>,
  ThemeToggle: ThemeToggle as ComponentType<Props>,
  MobileMenu: ({ footerHtml, ...p }: Props) => (
    <MobileMenu {...(p as Parameters<typeof MobileMenu>[0])} footer={footerHtml ? <Html html={String(footerHtml)} /> : undefined} />
  ),
  AddToCart: AddToCart as ComponentType<Props>,
  CartView: CartView as ComponentType<Props>,
  CheckoutForm: CheckoutForm as ComponentType<Props>,
  TrackForm: TrackForm as ComponentType<Props>,
  LoginForm: LoginForm as ComponentType<Props>,
  RegisterForm: RegisterForm as ComponentType<Props>,
  DeleteAccountForm: DeleteAccountForm as ComponentType<Props>,
  CustomRequestForm: CustomRequestForm as ComponentType<Props>,
  OrderNotify: OrderNotify as ComponentType<Props>,
  PaymentProofForm: PaymentProofForm as ComponentType<Props>,
  ReviewForm: ReviewForm as ComponentType<Props>,
  RememberOrder: RememberOrder as ComponentType<Props>,
  ReorderButton: ReorderButton as ComponentType<Props>,
  SupportWidget: SupportWidget as ComponentType<Props>,
  ServiceWorkerRegister: ServiceWorkerRegister as ComponentType<Props>,
  InstallPrompt: InstallPrompt as ComponentType<Props>,
  InstallAppButton: InstallAppButton as ComponentType<Props>,
  SetUsernameForm: SetUsernameForm as ComponentType<Props>,
  TopupForm: TopupForm as ComponentType<Props>,
  CopyButton: CopyButton as ComponentType<Props>,
  AdminNav: AdminNav as ComponentType<Props>,
  ForgotPasswordForm: ForgotPasswordForm as ComponentType<Props>,
  ChangePasswordForm: ChangePasswordForm as ComponentType<Props>,
  SupportNotifier: SupportNotifier as ComponentType<Props>,
  BrowserNotifyButton: BrowserNotifyButton as ComponentType<Props>,
  SupportThreadView: SupportThreadView as ComponentType<Props>,
  TelegramLink: TelegramLink as ComponentType<Props>,
};

function mount(el: HTMLElement) {
  const name = el.dataset.island ?? "";
  const C = registry[name];
  if (!C || el.dataset.mounted) return;
  el.dataset.mounted = "1";
  let props: Props = {};
  try {
    props = JSON.parse(el.dataset.props ?? "{}") as Props;
  } catch {
    /* keep empty props */
  }
  el.replaceChildren();
  createRoot(el).render(<C {...props} />);
}

function mountAll() {
  document.querySelectorAll<HTMLElement>("[data-island]").forEach(mount);
  initActionForms();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll, { once: true });
else mountAll();
