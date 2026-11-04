const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const { fail, sign } = require("../../../../shared/http");
const view = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  theme: user.theme || "dark",
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
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: "student",
  });
  res.status(201).json({ user: view(user), token: sign(user) });
};
exports.login = async (req, res) => {
  const { email, password } = credentials(req.body);
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    throw fail(401, "Email or password is incorrect.");
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
