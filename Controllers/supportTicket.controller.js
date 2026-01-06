/**
 * Support Ticket Controller
 * 
 * Handles support ticket operations:
 * - User submission (public)
 * - Admin management (CRUD, replies, status updates)
 */

const SupportTicket = require('../Models/supportTicket.model');
const User = require('../Models/user.model');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');

/**
 * Create a new support ticket (Public - users can submit tickets)
 * POST /api/support/tickets
 */
const createTicket = asyncwrapper(async (req, res, next) => {
  const { name, email, subject, message, type, priority } = req.body;
  const userId = req.user?.id || null; // Optional: user can be logged in or anonymous

  // Validation
  if (!name || !email || !subject || !message) {
    return next(AppError.create('Name, email, subject, and message are required', 400, httpstatustext.FAIL));
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(AppError.create('Please provide a valid email address', 400, httpstatustext.FAIL));
  }

  // If user is logged in, use their info
  let finalUserId = userId;
  let finalName = name;
  let finalEmail = email;

  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      finalName = user.name;
      finalEmail = user.email;
    }
  }

  // Create ticket
  const ticket = await SupportTicket.create({
    userId: finalUserId,
    name: finalName,
    email: finalEmail,
    subject: subject.trim(),
    message: message.trim(),
    type: type || 'general',
    priority: priority || 'medium',
    status: 'open',
  });

  res.status(201).json({
    status: httpstatustext.SUCCESS,
    message: 'Support ticket created successfully',
    data: { ticket },
  });
});

/**
 * Get all tickets (Admin only)
 * GET /api/admin/support/tickets
 */
const getAllTickets = asyncwrapper(async (req, res, next) => {
  const { status, type, priority, userId, page = 1, limit = 20 } = req.query;
  const tenantId = req.user.tenantId || req.user.id;

  // Build filter
  const filter = {};
  
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (priority) filter.priority = priority;
  if (userId) filter.userId = userId;

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);

  // Get tickets with pagination
  const tickets = await SupportTicket.find(filter)
    .populate('userId', 'name email')
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Get total count
  const total = await SupportTicket.countDocuments(filter);

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: {
      tickets,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

/**
 * Get single ticket (Admin only)
 * GET /api/admin/support/tickets/:id
 */
const getTicket = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;

  const ticket = await SupportTicket.findById(id)
    .populate('userId', 'name email phone')
    .populate('assignedTo', 'name email')
    .populate('replies.repliedBy', 'name email role');

  if (!ticket) {
    return next(AppError.create('Support ticket not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { ticket },
  });
});

/**
 * Get user's own tickets (Authenticated users)
 * GET /api/support/tickets
 */
const getUserTickets = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
  const { status, page = 1, limit = 20 } = req.query;

  const filter = { userId };
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);

  const tickets = await SupportTicket.find(filter)
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  const total = await SupportTicket.countDocuments(filter);

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: {
      tickets,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

/**
 * Update ticket status (Admin only)
 * PATCH /api/admin/support/tickets/:id/status
 */
const updateStatus = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;
  const { status, assignedTo } = req.body;

  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    return next(AppError.create('Support ticket not found', 404, httpstatustext.FAIL));
  }

  // Validate status
  const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (status && !validStatuses.includes(status)) {
    return next(AppError.create(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400, httpstatustext.FAIL));
  }

  // Update status
  if (status) {
    ticket.status = status;
  }

  // Update assignedTo
  if (assignedTo !== undefined) {
    if (assignedTo) {
      // Verify user exists
      const user = await User.findById(assignedTo);
      if (!user) {
        return next(AppError.create('Assigned user not found', 404, httpstatustext.FAIL));
      }
      ticket.assignedTo = assignedTo;
    } else {
      ticket.assignedTo = null;
    }
  }

  await ticket.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Ticket status updated successfully',
    data: { ticket },
  });
});

/**
 * Reply to ticket (Admin only)
 * POST /api/admin/support/tickets/:id/reply
 */
const replyToTicket = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;
  const { message } = req.body;
  const adminId = req.user.id;

  if (!message || !message.trim()) {
    return next(AppError.create('Reply message is required', 400, httpstatustext.FAIL));
  }

  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    return next(AppError.create('Support ticket not found', 404, httpstatustext.FAIL));
  }

  // Get admin name from User or Employee
  let adminName = 'Admin';
  if (req.user.isEmployee) {
    const Employee = require('../Models/employee.model');
    const employee = await Employee.findById(adminId);
    if (employee) adminName = employee.name;
  } else {
    const user = await User.findById(adminId);
    if (user) adminName = user.name;
  }

  // Add reply
  ticket.replies.push({
    message: message.trim(),
    repliedBy: adminId,
    repliedByName: adminName,
    isAdmin: true,
    createdAt: new Date(),
  });

  // Auto-update status if ticket was closed/resolved
  if (ticket.status === 'closed' || ticket.status === 'resolved') {
    ticket.status = 'in_progress';
  }

  await ticket.save();

  // Populate reply data
  await ticket.populate('replies.repliedBy', 'name email role');

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Reply added successfully',
    data: { ticket },
  });
});

/**
 * User reply to ticket (Authenticated users - can reply to their own tickets)
 * POST /api/support/tickets/:id/reply
 */
const userReplyToTicket = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;
  const { message } = req.body;
  const userId = req.user.id;

  if (!message || !message.trim()) {
    return next(AppError.create('Reply message is required', 400, httpstatustext.FAIL));
  }

  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    return next(AppError.create('Support ticket not found', 404, httpstatustext.FAIL));
  }

  // Verify user owns this ticket
  if (ticket.userId && ticket.userId.toString() !== userId.toString()) {
    return next(AppError.create('You can only reply to your own tickets', 403, httpstatustext.FAIL));
  }

  // Get user name from User or Employee
  let userName = 'User';
  if (req.user.isEmployee) {
    const Employee = require('../Models/employee.model');
    const employee = await Employee.findById(userId);
    if (employee) userName = employee.name;
  } else {
    const user = await User.findById(userId);
    if (user) userName = user.name;
  }

  // Add reply
  ticket.replies.push({
    message: message.trim(),
    repliedBy: userId,
    repliedByName: userName,
    isAdmin: false,
    createdAt: new Date(),
  });

  // Auto-update status if ticket was closed/resolved
  if (ticket.status === 'closed' || ticket.status === 'resolved') {
    ticket.status = 'open';
  }

  await ticket.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Reply added successfully',
    data: { ticket },
  });
});

/**
 * Delete ticket (Admin only)
 * DELETE /api/admin/support/tickets/:id
 */
const deleteTicket = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;

  const ticket = await SupportTicket.findByIdAndDelete(id);
  if (!ticket) {
    return next(AppError.create('Support ticket not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Support ticket deleted successfully',
  });
});

/**
 * Get ticket statistics (Admin only)
 * GET /api/admin/support/statistics
 */
const getStatistics = asyncwrapper(async (req, res, next) => {
  const tenantId = req.user.tenantId || req.user.id;

  const [
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    closedTickets,
    ticketsByType,
    ticketsByPriority,
  ] = await Promise.all([
    SupportTicket.countDocuments(),
    SupportTicket.countDocuments({ status: 'open' }),
    SupportTicket.countDocuments({ status: 'in_progress' }),
    SupportTicket.countDocuments({ status: 'resolved' }),
    SupportTicket.countDocuments({ status: 'closed' }),
    SupportTicket.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]),
    SupportTicket.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: {
      total: totalTickets,
      byStatus: {
        open: openTickets,
        in_progress: inProgressTickets,
        resolved: resolvedTickets,
        closed: closedTickets,
      },
      byType: ticketsByType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byPriority: ticketsByPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    },
  });
});

module.exports = {
  createTicket,
  getAllTickets,
  getTicket,
  getUserTickets,
  updateStatus,
  replyToTicket,
  userReplyToTicket,
  deleteTicket,
  getStatistics,
};

