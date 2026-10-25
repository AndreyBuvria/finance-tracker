/** An error for the whole form: an API message without a field, or the generic one. */
export type FormError = { readonly message: string } | 'generic';
