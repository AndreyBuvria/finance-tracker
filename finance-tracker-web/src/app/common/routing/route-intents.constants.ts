/**
 * Intent query params (CLAUDE.md "Dialogs are per purpose"): another feature opens a page's dialog
 * by navigating to it with the param, e.g. `/transactions?add=1` opens Quick add. The page opens
 * the dialog and removes the param.
 */
export const ADD_INTENT_PARAM = 'add';
export const ADD_INTENT_VALUE = '1';
