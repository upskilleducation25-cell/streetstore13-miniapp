const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Некоректний id відповідає так само, як неіснуючий (404), а не 500 від БД. */
export const isUuid = (value: string): boolean => UUID_RE.test(value);
