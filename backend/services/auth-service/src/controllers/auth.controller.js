const { randomBytes, createHash } = require("node:crypto");
const Session = require("../models/session.model");
const SESSION_AGE = 400 * 24 * 60 * 60 * 1000;
const cookieOptions = { httpOnly: true, secure: Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/auth" };
function sessionHash(req) {
  const value = (req.headers.cookie || "").split(";").map(part => part.trim()).find(part => part.startsWith("ep_session="))?.slice(11);
  return value && /^[a-f0-9]{64}$/.test(value) ? createHash("sha256").update(value).digest("hex") : null;
}
async function startSession(req, res, user) {
  const oldHash = sessionHash(req);
  if (oldHash) await Session.deleteOne({ tokenHash: oldHash });
  const token = randomBytes(32).toString("hex");
  await Session.create({ tokenHash: createHash("sha256").update(token).digest("hex"), userId: user._id, expiresAt: new Date(Date.now() + SESSION_AGE) });
  res.cookie("ep_session", token, { ...cookieOptions, maxAge: SESSION_AGE });
  res.set("Cache-Control", "no-store");
}
exports.session = async (req, res) => {
  res.set("Cache-Control", "no-store");
  const tokenHash = sessionHash(req);
  const session = tokenHash && await Session.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  const user = session && await User.findById(session.userId);
  if (!user) throw fail(401, "Please sign in to continue.");
  session.expiresAt = new Date(Date.now() + SESSION_AGE);
  await session.save();
  const token = req.headers.cookie.split(";").map(part => part.trim()).find(part => part.startsWith("ep_session=")).slice(11);
  res.cookie("ep_session", token, { ...cookieOptions, maxAge: SESSION_AGE });
  res.json({ user: view(user), token: sign(user) });
};
exports.logout = async (req, res) => {
  const tokenHash = sessionHash(req);
  if (tokenHash) await Session.deleteOne({ tokenHash });
  res.clearCookie("ep_session", cookieOptions);
  res.set("Cache-Control", "no-store").status(204).end();
};
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const { fail, sign } = require("../../../../shared/http");
const { university } = require("../../../../shared/campus");
const view = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  theme: user.theme || "dark",
  universityId: user.universityId || null,
  organizerRequested: Boolean(user.organizerRequested),
});
function credentials(body, registering = false) {
  const { name, email, password } = body;
  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  )
    throw fail(400, "Enter a valid email address.");
  if (
    typeof password !== "string" ||
    Buffer.byteLength(password) > 72 ||
    password.length < (registering ? 8 : 1)
  )
    throw fail(400, "Password must contain 8–72 bytes.");
  if (
    registering &&
    (typeof name !== "string" || name.trim().length < 2 || name.length > 80)
  )
    throw fail(400, "Name must contain 2–80 characters.");
  return { name: name?.trim(), email: email.trim().toLowerCase(), password };
}
exports.register = async (req, res) => {
  const { name, email, password } = credentials(req.body, true);
  if (!university(req.body.universityId)) throw fail(400, "Choose your university.");
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: "student",
    universityId: req.body.universityId,
    organizerRequested: req.body.organizerRequested === true,
  });
  await startSession(req, res, user);
  res.status(201).json({ user: view(user), token: sign(user) });
};
exports.login = async (req, res) => {
  const { email, password } = credentials(req.body);
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    throw fail(401, "Email or password is incorrect.");
  const selected = req.body.universityId;
  if (selected !== undefined) {
    if (!university(selected)) throw fail(400, "Choose your university.");
    if (user.universityId && user.universityId !== selected)
      throw fail(403, "This account belongs to a different university.");
    if (!user.universityId) { user.universityId = selected; await user.save(); }
  }
  await startSession(req, res, user);
  res.json({ user: view(user), token: sign(user) });
};
exports.me = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw fail(401, "Account not found. Please sign in again.");
  res.json({ user: view(user) });
};

exports.preferences = async (req, res) => {
  const { theme } = req.body || {};
  if (theme !== "dark" && theme !== "light")
    throw fail(400, "Choose dark or light mode.");
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: { theme } },
    { new: true, runValidators: true },
  );
  if (!user) throw fail(401, "Account not found. Please sign in again.");
  res.json({ user: view(user) });
};

exports.organizerRequests = async (req, res) => {
  const users = await User.find({ organizerRequested: true, role: "student" })
    .select("name email universityId organizerRequested role theme").limit(100);
  res.json({ users: users.map(view) });
};
exports.approveOrganizer = async (req, res) => {
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, organizerRequested: true, role: "student", universityId: { $exists: true } },
    { $set: { role: "organizer", organizerRequested: false } }, { new: true },
  );
  if (!user) throw fail(404, "Pending organizer request not found.");
  res.json({ user: view(user) });
};

exports.requestOrganizer = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw fail(401, "Account not found. Please sign in again.");
  if (!university(user.universityId)) throw fail(400, "Sign out and sign in with your university before requesting publishing access.");
  if (user.role === "student") { user.organizerRequested = true; await user.save(); }
  res.json({ user: view(user) });
};
