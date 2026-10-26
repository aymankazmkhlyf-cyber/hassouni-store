/** Shape returned by every form action; error values are keys of dictionary.errors. */
export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  data?: Record<string, unknown>;
};
