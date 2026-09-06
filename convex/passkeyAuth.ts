import { setupCore } from "@convex-dev/auth2/core/setup";
import { setupUsernamePasskey } from "@convex-dev/auth2/providers/passkey/setup";
import { setupAnonymous } from "@convex-dev/auth2/providers/anonymous/setup";
import { components, internal } from "./_generated/api";

import { env } from "./_generated/server";

const core = setupCore({ component: components.auth, issuer: `${env.CONVEX_SITE_URL}/auth` });
export const { signOut, refreshSession, isAuthenticated } = core;
export const { startSignIn, startAutofillSignIn, finishSignUp, finishSignIn } =
  setupUsernamePasskey(core, {
    component: components.authPasskey,
    usernameComponent: components.authUsername,
    rpId: env.AUTH_RP_ID ?? new URL(env.CONVEX_SITE_URL).hostname,
    origin: env.AUTH_ORIGIN ?? env.CONVEX_SITE_URL,
    rpName: "BUY HARD",
  }).attachUserCallbacks({ createUser: internal.authData.createPasskeyUser });
export const { signInAnonymous } = setupAnonymous(core, {
  component: components.authAnonymous,
}).attachUserCallbacks({ createUser: internal.authData.createAnonymousUser });
