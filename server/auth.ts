import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { assets, jobs } from "@shared/schema";
import { isNull } from "drizzle-orm";
import type { User } from "@shared/schema";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      role: string;
      status: string;
    }
  }
}

export function setupAuth(app: Express) {
  const PgStore = connectPgSimple(session);

  app.use(
    session({
      store: new PgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "smartdad-video-factory-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false, { message: "Invalid username or password" });

        const valid = await comparePasswords(password, user.password);
        if (!valid) return done(null, false, { message: "Invalid username or password" });

        return done(null, {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
        });
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      done(null, {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
      });
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      if (password.length < 4) {
        return res.status(400).json({ error: "Password must be at least 4 characters" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const hashed = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashed,
        role: "user",
        status: "pending",
      });

      res.status(201).json({ message: "Account created. Waiting for admin approval.", status: "pending" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "Login failed" });

      req.logIn(user, (err) => {
        if (err) return next(err);
        res.json({
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({
      id: req.user!.id,
      username: req.user!.username,
      role: req.user!.role,
      status: req.user!.status,
    });
  });

  app.patch("/api/auth/password", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: "New password must be at least 4 characters" });
    }

    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await comparePasswords(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: "Current password is incorrect" });

    const hashed = await hashPassword(newPassword);
    await storage.updateUser(user.id, { password: hashed });
    res.json({ message: "Password changed successfully" });
  });

  seedAdmin();
}

async function seedAdmin() {
  try {
    await db.execute(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS excluded_words TEXT` as any
    );
  } catch (err) {
    // column may already exist, ignore
  }

  try {
    let admin = await storage.getUserByUsername("admin");
    if (!admin) {
      const hashed = await hashPassword("admin123");
      admin = await storage.createUser({
        username: "admin",
        password: hashed,
        role: "admin",
        status: "approved",
      });
      console.log("Default admin account created (username: admin, password: admin123)");
    }

    const orphanAssets = await db.update(assets).set({ userId: admin.id }).where(isNull(assets.userId)).returning({ id: assets.id });
    const orphanJobs = await db.update(jobs).set({ userId: admin.id }).where(isNull(jobs.userId)).returning({ id: jobs.id });
    if (orphanAssets.length > 0 || orphanJobs.length > 0) {
      console.log(`Migrated ${orphanAssets.length} orphan assets and ${orphanJobs.length} orphan jobs to admin`);
    }
  } catch (err) {
    console.error("Failed to seed admin:", err);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user!.status === "pending") {
    return res.status(403).json({ error: "Account pending approval" });
  }
  if (req.user!.status === "restricted") {
    return res.status(403).json({ error: "Account restricted" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user!.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export { hashPassword, comparePasswords };
