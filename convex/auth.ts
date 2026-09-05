import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Anonymous({
      profile() {
        return {
          isAnonymous: true,
          name: "Judge demo buyer",
          role: "viewer" as const,
          isActive: true,
        };
      },
    }),
    Password({
      profile(params) {
        const email = String(params.email ?? "")
          .trim()
          .toLowerCase();
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error("Enter a valid email address.");
        }
        if (typeof params.name === "string" && params.name.trim().length > 120) {
          throw new Error("Keep your name under 121 characters.");
        }
        return {
          email,
          ...(typeof params.name === "string" && params.name.trim()
            ? { name: params.name.trim() }
            : {}),
          role: "viewer" as const,
          isActive: true,
        };
      },
    }),
  ],
});
