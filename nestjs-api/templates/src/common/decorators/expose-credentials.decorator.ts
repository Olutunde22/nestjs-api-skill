import { SetMetadata } from '@nestjs/common';

export const EXPOSE_CREDENTIALS_KEY = 'exposeCredentials';

// The only way a credential-shaped field leaves the API, e.g. a mobile sign-in that must
// return an access token in the body: @ExposeCredentials('accessToken', 'refreshToken').
// Name each field; there is no "expose everything".
export const ExposeCredentials = (...fields: [string, ...string[]]) =>
  SetMetadata(EXPOSE_CREDENTIALS_KEY, fields);
