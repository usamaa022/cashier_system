import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const isSuperRole = (r) => ["superadmin", "super_admin"].includes((r || "").toLowerCase());
const isAdminRole = (r) => (r || "").toLowerCase() === "admin";

async function getCaller(request, adminAuth, adminDb) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const snap = await adminDb.collection("users").doc(decoded.uid).get();
    let data = snap.exists ? snap.data() : null;
    if (!data && decoded.email) {
      const q = await adminDb.collection("users").where("email", "==", decoded.email).limit(1).get();
      if (!q.empty) data = q.docs[0].data();
    }
    return { uid: decoded.uid, email: (decoded.email || "").toLowerCase(), role: data?.role || "user" };
  } catch (e) {
    console.error("verifyIdToken failed:", e.message);
    return null;
  }
}

async function resolveAuthUser(adminAuth, uid, email) {
  try { return await adminAuth.getUser(uid); } catch {}
  if (email) {
    try { return await adminAuth.getUserByEmail(email); } catch {}
  }
  return null;
}

// Quick health check: open http://localhost:3000/api/admin/users in the browser
export async function GET() {
  try {
    getAdminAuth();
    return NextResponse.json({ ok: true, message: "Admin SDK is working." });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const caller = await getCaller(request, adminAuth, adminDb);
    if (!caller) return NextResponse.json({ error: "Not authenticated (token rejected)." }, { status: 401 });

    const { uid, displayName, password, role, branch } = await request.json();
    if (!uid) return NextResponse.json({ error: "User ID is required." }, { status: 400 });

    const targetRef = adminDb.collection("users").doc(uid);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const target = targetSnap.data();
    const targetEmail = (target.email || "").toLowerCase();

    const superAdmin = isSuperRole(caller.role);
    const admin = isAdminRole(caller.role);
    const isSelf = caller.uid === uid || (caller.email && caller.email === targetEmail);

    if (!superAdmin && !admin && !isSelf) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const updates = { updatedAt: new Date() };
    if (typeof displayName === "string") updates.displayName = displayName;
    if ((superAdmin || admin) && branch) updates.branch = branch;
    if (superAdmin && role) updates.role = role;

    let createdAuth = false;

    if (password) {
      if (!(superAdmin || isSelf)) {
        return NextResponse.json({ error: "You cannot change this user's password." }, { status: 403 });
      }
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      }

      const authUser = await resolveAuthUser(adminAuth, uid, targetEmail);
      if (authUser) {
        await adminAuth.updateUser(authUser.uid, {
          password,
          ...(typeof displayName === "string" && displayName ? { displayName } : {}),
        });
      } else {
        await adminAuth.createUser({
          uid,
          email: targetEmail,
          password,
          displayName: displayName || target.displayName || "",
        });
        createdAuth = true;
      }
      updates.password = password;
    } else if (typeof displayName === "string" && displayName) {
      const authUser = await resolveAuthUser(adminAuth, uid, targetEmail);
      if (authUser) await adminAuth.updateUser(authUser.uid, { displayName });
    }

    await targetRef.update(updates);
    return NextResponse.json({ success: true, createdAuth });
  } catch (err) {
    console.error("Admin update user error:", err);
    return NextResponse.json({ error: err.message || "Failed to update user." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const caller = await getCaller(request, adminAuth, adminDb);
    if (!caller) return NextResponse.json({ error: "Not authenticated (token rejected)." }, { status: 401 });
    if (!isSuperRole(caller.role)) {
      return NextResponse.json({ error: "Only SuperAdmin can delete users." }, { status: 403 });
    }

    const { uid } = await request.json();
    if (!uid) return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    if (uid === caller.uid) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    const targetRef = adminDb.collection("users").doc(uid);
    const targetSnap = await targetRef.get();
    const targetEmail = targetSnap.exists ? (targetSnap.data().email || "").toLowerCase() : "";

    const authUser = await resolveAuthUser(adminAuth, uid, targetEmail);
    if (authUser) await adminAuth.deleteUser(authUser.uid);
    await targetRef.delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin delete user error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete user." }, { status: 500 });
  }
}