import type { TokenScope } from "@schreibzeug/files-api";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

/*
 * What a route learns about the signed-in person, and the answers that refuse them. Here, below
 * auth/ and files/, so that the routes in files/ need nothing from auth/, which itself calls into
 * files/ when someone signs in (invitations, pending shares).
 */

/** The signed-in person as the API sees them. */
export type SessionUser = { id: string; name: string; email: string };

/** Who a request with this token acts for, and how far; the token's name says through what. */
export type TokenAccess = { user: SessionUser; tokenId: string; tokenName: string; scope: TokenScope };

/** How a request was signed in: a session cookie, a personal access token, or the sign-in provider. */
export type SignedInBy = "session" | "token" | "provider";

/**
 * What routes behind `requireUser` find on the context: the user, how they signed in, and the
 * personal access token the request came with, if it came with one; on a WebSocket upgrade the id
 * of the session it came with (app.ts), whose end closes the socket.
 */
export type AuthEnv = {
  Variables: { user: SessionUser; via?: SignedInBy; token?: TokenAccess; signInSession?: string };
};

export const refuse = (c: Context, status: 401 | 403, message: string) =>
  c.json(
    { error: { kind: status === 401 ? ("unauthorized" as const) : ("forbidden" as const), message } },
    status,
    status === 401 ? { "www-authenticate": 'Bearer realm="schreibzeug"' } : {},
  );

/**
 * For what a "read" token must not reach although it only reads: the secrets of links, which would
 * let another account edit what the token may only look at.
 */
export const refuseReadToken = createMiddleware<AuthEnv>(async (c, next) => {
  if (c.var.token?.scope === "read") return refuse(c, 403, "Dieser Zugangsschlüssel darf nur lesen.");
  await next();
});
