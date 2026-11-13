/** Macht aus den deutschen Literal-Typen allgemeine Typen, damit Englisch dieselbe Form erfüllt. */
export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => unknown
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> };
