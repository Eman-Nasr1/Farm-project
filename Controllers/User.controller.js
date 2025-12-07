const User = require('../Models/user.model');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const i18n = require('../i18n');
const { v4: uuidv4 } = require('uuid');
const ImpersonationSession = require('../Models/ImpersonationSession');
const IMPERSONATION_SECRET = process.env.IMPERSONATION_SECRET || process.env.JWT_SECRET_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
 // غيريها حسب بيئتك


const startImpersonation = asyncwrapper(async (req, res, next) => {
  const { userId } = req.params;

  // لازم إدمن
  if (!req.user || req.user.role !== 'admin') {
    return next(AppError.create('Admin access only', 403, httpstatustext.ERROR));
  }

  const target = await User.findById(userId);
  if (!target) return next(AppError.create('User not found', 404, httpstatustext.FAIL));

  // امنعي انتحال إدمن
  if (target.role === 'admin') {
    return next(AppError.create('Cannot impersonate another admin', 403, httpstatustext.ERROR));
  }

  const jti = uuidv4();
  const expiresInSec = 120; // صلاحية 2 دقيقة
  const expDate = new Date(Date.now() + expiresInSec * 1000);

  await ImpersonationSession.create({
    jti,
    targetUser: target._id,
    byAdmin: req.user.id,
    expiresAt: expDate,
  });

  const impToken = jwt.sign(
    { typ: 'imp', sub: String(target._id), by: String(req.user.id), jti },
    IMPERSONATION_SECRET,
    { expiresIn: `${expiresInSec}s` }
  );

  const url = `${APP_URL}/impersonate?token=${encodeURIComponent(impToken)}`;
  return res.json({ status: httpstatustext.SUCCESS, data: { url } });
});
const redeemImpersonation = asyncwrapper(async (req, res, next) => {
  const { token } = req.query;
  if (!token) return next(AppError.create('Missing token', 400, httpstatustext.FAIL));

  let payload;
  try {
    payload = jwt.verify(token, IMPERSONATION_SECRET);
  } catch (e) {
    return next(AppError.create('Invalid or expired token', 400, httpstatustext.FAIL));
  }

  if (payload.typ !== 'imp') {
    return next(AppError.create('Invalid token type', 400, httpstatustext.FAIL));
  }

  const session = await ImpersonationSession.findOne({ jti: payload.jti });
  if (!session || session.used) {
    return next(AppError.create('Token already used or not found', 400, httpstatustext.FAIL));
  }

  const user = await User.findById(payload.sub);
  if (!user) return next(AppError.create('User not found', 404, httpstatustext.ERROR));

  const normalToken = jwt.sign(
    { email: user.email, id: user._id, role: user.role, imp: true, impBy: payload.by, impJti: payload.jti },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '7d' }
  );

  session.used = true;
  await session.save();

  return res.json({
    status: httpstatustext.SUCCESS,
    data: { token: normalToken }
  });
});


const getallusers = asyncwrapper(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    const error = AppError.create('Admin access only', 403, httpstatustext.ERROR);
    return next(error);
  }

  const query = req.query;
  const limit = query.limit || 10;
  const page = query.page || 1;
  const skip = (page - 1) * limit;

  // Define the filter object (empty object to count all users)
  const filter = { role: { $ne: 'admin' } }; // $ne means "not equal"


  const users = await User.find(filter, { "__v": false, "password": false, "confirmpassword": false })
    .limit(limit)
    .skip(skip);

  const total = await User.countDocuments(filter); // Use the filter object here
  const totalPages = Math.ceil(total / limit);

  res.json({
    status: httpstatustext.SUCCESS,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    data: { users }
  });
});
const getsnigleuser = asyncwrapper(async (req, res, next) => {

  const user = await User.findById(req.params.userId);
  if (!user) {

    const error = AppError.create('User not found', 404, httpstatustext.FAIL)
    return next(error);
  }
  return res.json({ status: httpstatustext.SUCCESS, data: { user } });
})
const updateUser = asyncwrapper(async (req, res, next) => {
  const { userId } = req.params;
  const { name, email, phone, country, role, password } = req.body;

  // Find the user by ID
  const user = await User.findById(userId);
  if (!user) {
    const error = AppError.create(i18n.__('USER_NOT_FOUND'), 404, httpstatustext.FAIL);
    return next(error);
  }

  // Validate email uniqueness if being updated
  if (email && email !== user.email) {
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      const error = AppError.create(i18n.__('EMAIL_IN_USE'), 400, httpstatustext.FAIL);
      return next(error);
    }
  }

  // Handle password update if provided
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 7);
    user.password = hashedPassword;
  }

  // Update other user details
  if (name) user.name = name;
  if (email) user.email = email;
  if (phone) user.phone = phone;
  if (country) user.country = country;
  if (role) user.role = role;


  // Save the updated user
  await user.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { user },
  });
});
const deleteUser = asyncwrapper(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    const error = AppError.create(i18n.__('ADMIN_ACCESS_ONLY'), 403, httpstatustext.ERROR);
    return next(error);
  }
  await User.deleteOne({ _id: req.params.userId });
  res.status(200).json({ status: httpstatustext.SUCCESS, data: null });

})
const loginAsUser = asyncwrapper(async (req, res, next) => {
  const { userId } = req.params; // Get the user ID from the request parameters  

  // Find the user by ID  
  const user = await User.findById(userId);
  //console.log('User to log in as:', user); // Log the user being logged in as

  if (!user) {
    const error = AppError.create('User not found', 404, httpstatustext.FAIL);
    return next(error);
  }

  // Log the requester's details
  // console.log('Requester:', req.user);

  // Check if the requester is an admin  
  if (!req.user || req.user.role !== 'admin') {
    const error = AppError.create('Not authorized', 403, httpstatustext.FAIL);
    return next(error);
  }

  // Create a token for the user  
  const token = await jwt.sign(
    { email: user.email, id: user._id, role: user.role }, // Include user info in the payload  
    process.env.JWT_SECRET_KEY,
    { expiresIn: '7d' }
  );

  // Send the token back to the admin  
  return res.json({ status: httpstatustext.SUCCESS, data: { token } });
});

const register = asyncwrapper(async (req, res, next) => {
  const { name, email, password, confirmpassword, phone, country, role, registerationType } = req.body;

  const olderuser = await User.findOne({ email: email });
  if (olderuser) {
    const error = AppError.create(i18n.__('USER_EXISTS'), 400, httpstatustext.FAIL);
    return next(error);
  }
  if (password !== confirmpassword) {
    const error = AppError.create(i18n.__('PASSWORD_MISMATCH'), 400, httpstatustext.FAIL);
    return next(error);
  }

  const hashpassword = await bcrypt.hash(password, 7);
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  
  const newuser = new User({
    name,
    email,
    password: hashpassword,
    confirmpassword: hashpassword,
    phone,
    role,
    registerationType,
    country,
    // Start 30-day free trial (no Stripe subscription yet)
    subscriptionStatus: 'trialing',
    trialStart: now,
    trialEnd: trialEnd,
    planId: null // no paid plan yet
  })
  const token = await jwt.sign(
    { email: newuser.email, id: newuser._id, role: newuser.role, name: newuser.name, registerationType: newuser.registerationType }, // Include 'role' in the payload
    process.env.JWT_SECRET_KEY,
    { expiresIn: '7d' })

  newuser.token = token;
  await newuser.save();

  res.status(201).json({ status: httpstatustext.SUCCESS, data: { user: newuser } });

})

const login = asyncwrapper(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email && !password) {
    const error = AppError.create(i18n.__('EMAIL_PASSWORD_REQUIRED'), 400, httpstatustext.FAIL);
    return next(error);
  }
  const user = await User.findOne({ email: email });

  if (!user) {
    const error = AppError.create(i18n.__('USER_NOT_FOUND'), 404, httpstatustext.ERROR);
    return next(error);
  }

  const matchedpassword = await bcrypt.compare(password, user.password);
  if (user && matchedpassword) {
    // Initialize trial for existing users who don't have one yet (only if no subscription)
    if (!user.trialStart && !user.trialEnd && user.subscriptionStatus === 'none' && !user.planId) {
      const now = new Date();
      user.subscriptionStatus = 'trialing';
      user.trialStart = now;
      user.trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await user.save();
    }
    
    const token = await jwt.sign(
      { email: user.email, id: user._id, role: user.role, registerationType: user.registerationType }, // Include 'role' in the payload
      process.env.JWT_SECRET_KEY,
      { expiresIn: '7d' }
    );
    res.status(201).json({ status: httpstatustext.SUCCESS, data: { token } });
  }
  else {
    const error = AppError.create(i18n.__('SOMETHING_WRONG'), 500, httpstatustext.ERROR);
    return next(error);
  }

})


const forgotPassword = asyncwrapper(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(AppError.create(i18n.__('EMAIL_REQUIRED'), 400, httpstatustext.FAIL));
  }

  const user = await User.findOne({ email });

  if (!user) {
    return next(AppError.create(i18n.__('USER_NOT_FOUND'), 404, httpstatustext.ERROR));
  }

  // Generate a 6-digit verification code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Store the verification code and its expiration time in the user's document
  user.resetPasswordToken = verificationCode; // Store the verification code
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

  await user.save();

  // Send email with the verification code
  const transporter = nodemailer.createTransport({
    service: 'Gmail', // Using Gmail as an example
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    to: email,
    subject: 'Password Reset Verification Code',
    html: `<p>Your password reset verification code is:</p>
           <h2>${verificationCode}</h2>
           <p>This code will expire in 1 hour. Please use it to reset your password.</p>`,
  };

  await transporter.sendMail(mailOptions);

  res.status(200).json({ status: httpstatustext.SUCCESS, message: i18n.__('VERIFICATION_CODE_SENT') });
});


const verifyCode = asyncwrapper(async (req, res, next) => {
  const { verificationCode } = req.body;

  if (!verificationCode) {
    return next(AppError.create(i18n.__('VERIFICATION_CODE_REQUIRED'), 400, httpstatustext.FAIL));
  }

  const user = await User.findOne({
    resetPasswordToken: verificationCode,
    resetPasswordExpires: { $gt: Date.now() }, // Ensure the token is not expired
  });

  if (!user) {
    return next(AppError.create(i18n.__('INVALID_EXPIRED_CODE'), 400, httpstatustext.ERROR));
  }

  // Generate a token (JWT) with the user's ID
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });

  // Send the token back to the user
  res.status(200).json({ status: httpstatustext.SUCCESS, message: i18n.__('VERIFICATION_CODE_VALID'), token });
});

// Function to handle password reset  
const resetPassword = asyncwrapper(async (req, res, next) => {
  const { newPassword } = req.body;
  const token = req.headers.authorization?.split(' ')[1]; // Extract the token from the Authorization header

  if (!newPassword) {
    return next(AppError.create('New password is required', 400, httpstatustext.FAIL));
  }

  if (!token) {
    return next(AppError.create('No token provided', 401, httpstatustext.FAIL));
  }

  // Verify the token and extract the user's ID
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  const userId = decoded.id;

  // Find the user by ID
  const user = await User.findById(userId);

  if (!user) {
    return next(AppError.create('User not found', 404, httpstatustext.ERROR));
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 7);

  // Update the user's password
  user.password = hashedPassword;
  user.resetPasswordToken = undefined; // Clear the token fields
  user.resetPasswordExpires = undefined;

  // Save the updated user
  await user.save();

  // Send success response
  res.status(200).json({ status: httpstatustext.SUCCESS, message: 'Password has been reset successfully' });
});



module.exports = {
  getallusers,
  register,
  login,
  resetPassword,
  forgotPassword,
  verifyCode,
  getsnigleuser,
  deleteUser,
  updateUser,
  loginAsUser,
  startImpersonation,
  redeemImpersonation,
}