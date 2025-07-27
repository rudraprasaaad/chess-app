/* eslint-disable @typescript-eslint/no-explicit-any */
import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";

import { logger } from "../services/logger";

import { prisma } from "../lib/prisma";
import {
  GOOGLE_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from "../lib/consts";
import { AuthProvider } from "../lib/types";

export function initPassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID!,
        clientSecret: GOOGLE_CLIENT_SECRET!,
        callbackURL: GOOGLE_CALLBACK_URL!,
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done
      ) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            logger.error("Google profile has no email");
            return done(
              new Error("No email found in Google Profile"),
              undefined
            );
          }

          let user = await prisma.user.findFirst({
            where: {
              providerId: profile.id,
            },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                name: profile.displayName,
                username:
                  profile.username?.toLowerCase() ||
                  profile.displayName.toLowerCase(),
                provider: AuthProvider.GOOGLE,
                providerId: profile.id,
              },
            });
            logger.info(`Welcome ${profile.displayName}`);
          } else {
            logger.info(`${profile.displayName} got logged in`);
          }
          done(null, user);
        } catch (err) {
          logger.error("GoogleStrategy error", err);
          done(err, undefined);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id,
        },
      });
      done(null, user);
    } catch (err) {
      done(err, undefined);
    }
  });

  logger.info("Passport initialized with GoogleStrategy");
}
