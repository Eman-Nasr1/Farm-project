const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const CourseRegistration = require('../Models/courseRegistration.model');
const CourseStudent = require('../Models/courseStudent.model');
const { getCoursePrice } = require('../utilits/coursePrices');
const { generateBookingCode } = require('../utilits/courseBookingCode');
const { toStorageKey } = require('../middleware/courseUpload');
const { pushStatusHistory } = require('./courseService');
const { EGYPTIAN_PHONE_REGEX } = require('../middleware/course.validation');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');

function parseParticipants(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function generateTempPassword() {
  return crypto.randomBytes(4).toString('hex'); // 8 chars
}

/**
 * Create CourseStudent accounts for all 5 group participants.
 * Leader email (from form) must match one participant — that account uses leaderPassword.
 * Other members get a generated temp password (returned once in response).
 *
 * @returns {Promise<{ members: Array, leader: Object, createdStudentIds: ObjectId[] }>}
 */
async function createGroupMemberAccounts({
  participants,
  participantDocs,
  leaderFullName,
  leaderEmail,
  leaderPhone,
  leaderPassword,
}) {
  const leaderEmailNorm = String(leaderEmail).trim().toLowerCase();
  const leaderPhoneNorm = String(leaderPhone).trim();

  if (participants.length !== 5) {
    throw AppError.create(
      'Group registration requires exactly 5 participants',
      400,
      httpstatustext.FAIL
    );
  }

  if (participantDocs.length !== 5) {
    throw AppError.create(
      'Group registration requires exactly 5 student ID card uploads',
      400,
      httpstatustext.FAIL
    );
  }

  const emails = new Set();
  const phones = new Set();
  let leaderIndex = -1;

  for (let i = 0; i < participants.length; i += 1) {
    const p = participants[i];
    if (!p.fullName || !p.email || !p.phone) {
      throw AppError.create(
        `Participant ${i + 1} is missing fullName, email, or phone`,
        400,
        httpstatustext.FAIL
      );
    }

    const email = String(p.email).trim().toLowerCase();
    const phone = String(p.phone).trim();

    if (!EGYPTIAN_PHONE_REGEX.test(phone)) {
      throw AppError.create(
        `Participant ${i + 1} has an invalid Egyptian phone number`,
        400,
        httpstatustext.FAIL
      );
    }

    if (emails.has(email)) {
      throw AppError.create(`Duplicate participant email: ${email}`, 400, httpstatustext.FAIL);
    }
    if (phones.has(phone)) {
      throw AppError.create(`Duplicate participant phone: ${phone}`, 400, httpstatustext.FAIL);
    }
    emails.add(email);
    phones.add(phone);

    if (email === leaderEmailNorm) {
      leaderIndex = i;
    }
  }

  if (leaderIndex === -1) {
    throw AppError.create(
      'Group leader email must match one of the 5 participants. The leader is the member who will pay.',
      400,
      httpstatustext.FAIL
    );
  }

  // Leader phone on form should match that participant phone (avoid mismatch)
  const leaderParticipantPhone = String(participants[leaderIndex].phone).trim();
  if (leaderParticipantPhone !== leaderPhoneNorm) {
    throw AppError.create(
      'Group leader phone must match the phone of the participant with the same email',
      400,
      httpstatustext.FAIL
    );
  }

  // Ensure none of the emails/phones already exist
  const existing = await CourseStudent.find({
    $or: [
      { email: { $in: [...emails] } },
      { phone: { $in: [...phones] } },
    ],
  }).select('email phone');

  if (existing.length > 0) {
    const conflict = existing
      .map((s) => s.email || s.phone)
      .join(', ');
    throw AppError.create(
      `One or more participants already have a course account: ${conflict}`,
      400,
      httpstatustext.FAIL
    );
  }

  const createdStudentIds = [];
  const members = [];
  let leader = null;

  try {
    for (let i = 0; i < participants.length; i += 1) {
      const p = participants[i];
      const email = String(p.email).trim().toLowerCase();
      const phone = String(p.phone).trim();
      const fullName = String(p.fullName).trim();
      const isLeader = i === leaderIndex;

      const plainPassword = isLeader
        ? leaderPassword
        : (p.password && String(p.password).length >= 6
            ? String(p.password)
            : generateTempPassword());

      const hashedPassword = await bcrypt.hash(plainPassword, 7);

      const student = await CourseStudent.create({
        fullName: isLeader ? (leaderFullName || fullName) : fullName,
        email,
        phone,
        password: hashedPassword,
      });

      createdStudentIds.push(student._id);

      const memberInfo = {
        id: student._id,
        fullName: student.fullName,
        email: student.email,
        phone: student.phone,
        isLeader,
        temporaryPassword: isLeader ? undefined : plainPassword,
        verificationDocumentUrl: toStorageKey(participantDocs[i].path),
      };

      members.push(memberInfo);
      if (isLeader) leader = student;
    }
  } catch (error) {
    if (createdStudentIds.length > 0) {
      await CourseStudent.deleteMany({ _id: { $in: createdStudentIds } });
    }
    throw error;
  }

  return { members, leader, createdStudentIds };
}

/**
 * Build and save a CourseRegistration from multipart request fields/files.
 *
 * For student_group:
 * - creates 5 CourseStudent accounts
 * - leader (payer) must be one of the 5 (email match)
 * - returns { registration, groupMembers, leader }
 *
 * For other categories:
 * - uses existing studentId
 * - returns { registration }
 */
async function createRegistrationFromRequest({
  studentId,
  body,
  files,
  file,
  leaderInfo = null,
}) {
  const category = body.category;

  let amount;
  try {
    amount = getCoursePrice(category);
  } catch {
    throw AppError.create('Invalid registration category', 400, httpstatustext.FAIL);
  }

  const rawParticipants = parseParticipants(body.participants);
  let verificationDocumentUrl = null;
  const participantDocs = files?.participantDocuments || [];

  let participants = [];
  let groupMembers = [];
  let groupLeaderId = null;
  let leaderStudent = null;
  let groupMemberAccounts = null;
  let effectiveStudentId = studentId;

  if (category === 'student_group') {
    if (!leaderInfo?.email || !leaderInfo?.password || !leaderInfo?.phone) {
      throw AppError.create(
        'Group registration requires leader fullName, email, phone and password',
        400,
        httpstatustext.FAIL
      );
    }

    groupMemberAccounts = await createGroupMemberAccounts({
      participants: rawParticipants,
      participantDocs,
      leaderFullName: leaderInfo.fullName,
      leaderEmail: leaderInfo.email,
      leaderPhone: leaderInfo.phone,
      leaderPassword: leaderInfo.password,
    });

    leaderStudent = groupMemberAccounts.leader;
    effectiveStudentId = leaderStudent._id;
    groupLeaderId = leaderStudent._id;
    groupMembers = groupMemberAccounts.createdStudentIds;

    participants = groupMemberAccounts.members.map((m) => ({
      fullName: m.fullName,
      email: m.email,
      phone: m.phone,
      verificationDocumentUrl: m.verificationDocumentUrl,
      student: m.id,
    }));
  } else {
    if (rawParticipants.length > 0) {
      throw AppError.create(
        'Participants are only allowed for student_group category',
        400,
        httpstatustext.FAIL
      );
    }

    const docFile = files?.verificationDocument?.[0] || file;
    if (!docFile) {
      throw AppError.create('Verification document is required', 400, httpstatustext.FAIL);
    }
    verificationDocumentUrl = toStorageKey(docFile.path);
    groupLeaderId = studentId;
  }

  const bookingCode = await generateBookingCode();

  const registration = new CourseRegistration({
    student: effectiveStudentId,
    groupLeader: groupLeaderId,
    groupMembers,
    category,
    amount,
    bookingCode,
    verificationDocumentUrl,
    participants,
    registrationStatus: 'pending_payment',
  });

  pushStatusHistory(registration, {
    oldStatus: null,
    newStatus: 'pending_payment',
    changedBy: effectiveStudentId,
    changedByType: 'course_student',
    reason:
      category === 'student_group'
        ? 'Group registration created with 5 member accounts'
        : 'Registration created',
  });

  try {
    await registration.save();
  } catch (error) {
    if (groupMemberAccounts?.createdStudentIds?.length) {
      await CourseStudent.deleteMany({
        _id: { $in: groupMemberAccounts.createdStudentIds },
      });
    }
    throw error;
  }

  return {
    registration,
    leader: leaderStudent,
    groupMembers: groupMemberAccounts
      ? groupMemberAccounts.members.map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.email,
          phone: m.phone,
          isLeader: m.isLeader,
          temporaryPassword: m.temporaryPassword || null,
        }))
      : [],
  };
}

module.exports = {
  parseParticipants,
  createRegistrationFromRequest,
  createGroupMemberAccounts,
  generateTempPassword,
};
