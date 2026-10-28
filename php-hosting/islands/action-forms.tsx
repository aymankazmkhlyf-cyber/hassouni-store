/*
 * PHP version of the admin <ActionForm>: the form body is rendered by PHP,
 * this script submits it in the background, disables the submit button while
 * pending, and shows the result exactly like the original (error alert with
 * field list, or success alert). After a successful change the page reloads
 * so server-rendered data updates (like revalidatePath), and the success
 * message is shown again on the reloaded form.
 */
import { createRoot, type Root } from "react-dom/client";
import { fmt } from "@/lib/i18n/config";
import { Alert } from "@/components/ui/alert";
import type { ActionState } from "@/app/actions/types";

const FLASH = "hds_action_flash";
const SPINNER =
  '<svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25" stroke-width="3"></circle><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path></svg>';

type Reply = { state: ActionState | null; redirect?: string; refresh?: number };

function Result({ state, messages, labels }: { state: ActionState; messages: Record<string, string>; labels: Record<string, string> }) {
  const describe = (field: string, code: string) => {
    const m = /^line:(\d+):(\w+)$/.exec(code);
    if (m) return fmt(messages.lineError ?? "{field} {line}", { field: labels[field] ?? field, line: m[1]!, reason: m[2]! });
    const text = messages[code] ?? messages.validation ?? code;
    return `${labels[field] ?? field}: ${fmt(text, { field: labels[field] ?? field })}`;
  };
  if (state.error) {
    return (
      <Alert tone="danger" title={messages[state.error] ?? messages.generic} className="mb-4">
        {state.fieldErrors ? (
          <ul className="list-disc ps-4">
            {Object.entries(state.fieldErrors).map(([f, c]) => (
              <li key={f}>{describe(f, c)}</li>
            ))}
          </ul>
        ) : null}
      </Alert>
    );
  }
  if (state.ok && state.message) return <Alert tone="success" title={messages[state.message] ?? state.message} className="mb-4" />;
  return null;
}

const roots = new WeakMap<HTMLElement, Root>();

function show(form: HTMLFormElement, state: ActionState) {
  let box = form.querySelector<HTMLElement>(":scope > [data-af-result]");
  if (!box) {
    box = document.createElement("div");
    box.dataset.afResult = "";
    form.prepend(box);
  }
  const root = roots.get(box) ?? createRoot(box);
  roots.set(box, root);
  const parse = (k: string) => {
    try {
      return JSON.parse(form.dataset[k] ?? "{}") as Record<string, string>;
    } catch {
      return {};
    }
  };
  root.render(<Result state={state} messages={parse("messages")} labels={parse("labels")} />);
}

function setPending(form: HTMLFormElement, pending: boolean) {
  form.querySelectorAll<HTMLButtonElement>("button[type=submit], button:not([type])").forEach((b) => {
    if (pending) {
      b.dataset.html = b.innerHTML;
      b.disabled = true;
      b.setAttribute("aria-disabled", "true");
      const label = b.dataset.pendingLabel ?? b.textContent ?? "";
      b.innerHTML = `${SPINNER}<span></span>`;
      b.querySelector("span")!.textContent = label.trim();
    } else if (b.dataset.html != null) {
      b.innerHTML = b.dataset.html;
      b.disabled = false;
      b.removeAttribute("aria-disabled");
    }
  });
}

function formId(form: HTMLFormElement) {
  const all = Array.from(document.querySelectorAll<HTMLFormElement>("form[data-action-form]"));
  return `${location.pathname}#${all.indexOf(form)}:${form.getAttribute("action")}`;
}

async function submit(form: HTMLFormElement, submitter: HTMLElement | null) {
  if (form.dataset.pending) return;
  const fd = new FormData(form, submitter);
  form.dataset.pending = "1";
  setPending(form, true);
  let reply: Reply;
  try {
    const res = await fetch(form.action, { method: "POST", body: fd, credentials: "same-origin", headers: { "X-Requested-With": "fetch" } });
    reply = (await res.json()) as Reply;
  } catch {
    reply = { state: { error: "generic" } };
  }
  if (reply.redirect) {
    window.location.assign(reply.redirect);
    return;
  }
  const state = reply.state ?? {};
  if (state.ok) {
    // Server-rendered data changed: reload, then show the success message again.
    try {
      sessionStorage.setItem(FLASH, JSON.stringify({ id: formId(form), state }));
    } catch {
      /* ignore */
    }
    window.location.reload();
    return;
  }
  delete form.dataset.pending;
  setPending(form, false);
  show(form, state);
}

export function initActionForms() {
  let flash: { id: string; state: ActionState } | null = null;
  try {
    flash = JSON.parse(sessionStorage.getItem(FLASH) ?? "null");
    sessionStorage.removeItem(FLASH);
  } catch {
    flash = null;
  }
  document.querySelectorAll<HTMLFormElement>("form[data-action-form]").forEach((form) => {
    if (flash && flash.id === formId(form)) show(form, flash.state);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const submitter = (e as SubmitEvent).submitter as HTMLElement | null;
      const confirmText = submitter?.dataset.confirm;
      if (confirmText && !window.confirm(confirmText)) return;
      void submit(form, submitter);
    });
  });
}
