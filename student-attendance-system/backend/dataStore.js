const fs = require('fs');
const path = require('path');

const PERSISTENCE_FILE = path.join(__dirname, 'data-store.json');

const subjectCodeToLabel = {
  'aiml12': 'AIML',
  'aiml': 'AIML',
  'AIML': 'AIML',
  'db12': 'DBMS',
  'dbms': 'DBMS',
  'DBMS': 'DBMS',
  'math12': 'Mathematics',
  'mathematics': 'Mathematics',
  'Mathematics': 'Mathematics',
  'py12': 'Python',
  'python': 'Python',
  'Python': 'Python',
  'ds12': 'Data Structures',
  'data structures': 'Data Structures',
  'Data Structures': 'Data Structures',
  'General': 'General',
  'general': 'General'
};

const subjectLabelToCodes = {
  'AIML': ['aiml12', 'aiml', 'AIML'],
  'DBMS': ['db12', 'dbms', 'DBMS'],
  'Mathematics': ['math12', 'mathematics', 'Mathematics'],
  'Python': ['py12', 'python', 'Python'],
  'Data Structures': ['ds12', 'data structures', 'Data Structures'],
  'General': ['General', 'general']
};

const normalizeSubject = (subject) => {
  if (!subject && subject !== '') return 'General';
  return subjectCodeToLabel[String(subject).trim()] || String(subject).trim();
};

const matchSubjectFilter = (value, filter) => {
  if (!filter) return true;
  const normalizedValue = normalizeSubject(value).toLowerCase();
  const normalizedFilter = normalizeSubject(filter).toLowerCase();
  if (normalizedValue === normalizedFilter) return true;
  const aliasValues = subjectLabelToCodes[normalizeSubject(filter)] || [];
  return aliasValues.map((val) => String(val).toLowerCase()).includes(normalizedValue) || aliasValues.map((val) => String(val).toLowerCase()).includes(String(value || '').toLowerCase());
};

const convertSubjectCode = (code) => {
  return subjectCodeToLabel[code] || normalizeSubject(code);
};

let memoryDB = {
  teachers: [
    { teacher_id: 1, username: 'asha_rao', password: 'password123', full_name: 'Dr. Asha Rao', email: 'asha@example.com', phone: '9876543210', department: 'Computer Science', role: 'teacher' },
    { teacher_id: 2, username: 'mohit_verma', password: 'password123', full_name: 'Prof. Mohit Verma', email: 'mohit@example.com', phone: '9876543211', department: 'Mathematics', role: 'teacher' },
    { teacher_id: 99, username: 'admin', password: 'password123', full_name: 'Admin User', email: 'admin@example.com', phone: '9999999999', department: 'Administration', role: 'admin' },
  ],
  classes: [
    { class_id: 1, class_name: 'AIML', section: 'A', teacher_id: 1 },
    { class_id: 2, class_name: 'AIML', section: 'B', teacher_id: 2 },
  ],
  students: [
    { student_id: 1, username: 'aarav_101', password: 'password123', roll_number: '101', full_name: 'Aarav Mehta', class_id: 1, email: 'aarav@example.com', phone: '9000000001', role: 'student' },
    { student_id: 2, username: 'diya_102', password: 'password123', roll_number: '102', full_name: 'Diya Sharma', class_id: 1, email: 'diya@example.com', phone: '9000000002', role: 'student' },
    { student_id: 3, username: 'rohan_201', password: 'password123', roll_number: '201', full_name: 'Rohan Iyer', class_id: 2, email: 'rohan@example.com', phone: '9000000003', role: 'student' },
  ],
  attendance: [],
  subject_marks: [],
  leave_requests: [],
};

let nextIds = {
  teacher_id: 3,
  class_id: 3,
  student_id: 4,
  attendance_id: 1,
  leave_id: 1,
};

const saveDataStoreToFile = () => {
  try {
    const payload = {
      memoryDB,
      nextIds,
    };
    fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (error) {
    console.warn('Unable to persist in-memory data:', error.message);
  }
};

const mergeEntities = (defaults, persisted, idField) => {
  const entities = new Map(defaults.map((item) => [String(item[idField]), { ...item }]));
  if (Array.isArray(persisted)) {
    persisted.forEach((item) => {
      const key = String(item[idField]);
      const existing = entities.get(key) || {};
      entities.set(key, { ...existing, ...item });
    });
  }
  return Array.from(entities.values());
};

const loadPersistedDataStore = () => {
  try {
    if (!fs.existsSync(PERSISTENCE_FILE)) return;
    const raw = fs.readFileSync(PERSISTENCE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (parsed.memoryDB && parsed.nextIds) {
        const persistedTeachers = Array.isArray(parsed.memoryDB.teachers) ? parsed.memoryDB.teachers : [];
        const persistedClasses = Array.isArray(parsed.memoryDB.classes) ? parsed.memoryDB.classes : [];
        const persistedStudents = Array.isArray(parsed.memoryDB.students) ? parsed.memoryDB.students : [];

        persistedTeachers.forEach((teacher) => {
          teacher.username = teacher.username || teacher.full_name.toLowerCase().replace(/[^a-z0-9]+/gi, '_');
          teacher.password = teacher.password || 'password123';
          teacher.role = teacher.role || 'teacher';
        });

        persistedStudents.forEach((student) => {
          student.username = student.username || student.roll_number || `student_${student.student_id}`;
          student.password = student.password || 'password123';
          student.role = student.role || 'student';
        });

        memoryDB = {
          teachers: mergeEntities(memoryDB.teachers, persistedTeachers, 'teacher_id'),
          classes: mergeEntities(memoryDB.classes, persistedClasses, 'class_id'),
          students: mergeEntities(memoryDB.students, persistedStudents, 'student_id'),
          attendance: Array.isArray(parsed.memoryDB.attendance) ? parsed.memoryDB.attendance : memoryDB.attendance,
          subject_marks: Array.isArray(parsed.memoryDB.subject_marks) ? parsed.memoryDB.subject_marks : memoryDB.subject_marks,
          leave_requests: Array.isArray(parsed.memoryDB.leave_requests) ? parsed.memoryDB.leave_requests : memoryDB.leave_requests,
        };
        nextIds = {
          teacher_id: Number(parsed.nextIds.teacher_id) || nextIds.teacher_id,
          class_id: Number(parsed.nextIds.class_id) || nextIds.class_id,
          student_id: Number(parsed.nextIds.student_id) || nextIds.student_id,
          attendance_id: Number(parsed.nextIds.attendance_id) || nextIds.attendance_id,
          leave_id: Number(parsed.nextIds.leave_id) || nextIds.leave_id,
        };
      }
    }
  } catch (error) {
    console.warn('Unable to load persisted in-memory data:', error.message);
  }
};

loadPersistedDataStore();

const withTeacherNames = (students, classes, teachers) => {
  return students.map((student) => {
    const classInfo = classes.find((item) => item.class_id === student.class_id);
    const teacher = teachers.find((item) => item.teacher_id === classInfo?.teacher_id);

    return {
      ...student,
      class_name: classInfo?.class_name || null,
      section: classInfo?.section || null,
      teacher_name: teacher?.full_name || null,
    };
  });
};

const listStudents = () => withTeacherNames([...memoryDB.students], [...memoryDB.classes], [...memoryDB.teachers]);

const createStudent = (payload) => {
  const student = {
    student_id: String(payload.roll_number),
    role: payload.role || 'student',
    ...payload,
    class_id: payload.class_id ? Number(payload.class_id) : null,
  };
  memoryDB.students.push(student);
  saveDataStoreToFile();
  return student;
};

const updateStudent = (id, payload) => {
  const index = memoryDB.students.findIndex((student) => student.student_id === String(id));
  if (index === -1) return null;
  memoryDB.students[index] = {
    ...memoryDB.students[index],
    ...payload,
    student_id: String(id),
    class_id: payload.class_id ? Number(payload.class_id) : memoryDB.students[index].class_id,
  };
  saveDataStoreToFile();
  return memoryDB.students[index];
};

const deleteStudent = (id) => {
  const studentId = String(id);
  memoryDB.students = memoryDB.students.filter((student) => student.student_id !== studentId);
  memoryDB.attendance = memoryDB.attendance.filter((item) => item.student_id !== studentId);
  memoryDB.subject_marks = memoryDB.subject_marks.filter((item) => item.student_id !== studentId);
  memoryDB.leave_requests = memoryDB.leave_requests.filter((item) => item.student_id !== studentId);
  saveDataStoreToFile();
};

const resolveStudentRecord = (studentId) => {
  const studentKey = String(studentId);
  return memoryDB.students.find((student) => student.student_id === studentKey || student.roll_number === studentKey) || null;
};

const saveSubjectMarks = (studentId, subject, ia1, ia2, ia3) => {
  const student = resolveStudentRecord(studentId);
  if (!student) return null;

  const scores = [Number(ia1), Number(ia2), Number(ia3)];
  const bestTwoAverage = Number((scores.slice().sort((a, b) => b - a).slice(0, 2).reduce((sum, value) => sum + value, 0) / 2).toFixed(2));
  const status = bestTwoAverage >= 10 ? 'Pass' : 'Fail';
  const updatedAt = new Date().toISOString();

  const index = memoryDB.subject_marks.findIndex((item) => item.student_id === student.student_id && item.subject === subject);
  const record = {
    mark_id: index >= 0 ? memoryDB.subject_marks[index].mark_id : memoryDB.subject_marks.length + 1,
    student_id: student.student_id,
    full_name: student.full_name,
    roll_number: student.roll_number,
    subject,
    ia1,
    ia2,
    ia3,
    best_two_average: bestTwoAverage,
    status,
    updated_at: updatedAt,
  };

  if (index >= 0) {
    memoryDB.subject_marks[index] = record;
  } else {
    memoryDB.subject_marks.push(record);
  }

  saveDataStoreToFile();
  return record;
};

const getSubjectMarks = (studentId) => {
  const student = resolveStudentRecord(studentId);
  if (!student) return [];

  return memoryDB.subject_marks
    .filter((item) => item.student_id === student.student_id)
    .sort((a, b) => a.subject.localeCompare(b.subject));
};

const listTeachers = () => [...memoryDB.teachers];

const createTeacher = (payload) => {
  const teacher = {
    teacher_id: nextIds.teacher_id++,
    role: payload.role || 'teacher',
    ...payload,
  };
  memoryDB.teachers.push(teacher);
  saveDataStoreToFile();
  return teacher;
};

const updateTeacher = (id, payload) => {
  const index = memoryDB.teachers.findIndex((teacher) => teacher.teacher_id === Number(id));
  if (index === -1) return null;
  memoryDB.teachers[index] = { ...memoryDB.teachers[index], ...payload, teacher_id: Number(id) };
  saveDataStoreToFile();
  return memoryDB.teachers[index];
};

const deleteTeacher = (id) => {
  memoryDB.teachers = memoryDB.teachers.filter((teacher) => teacher.teacher_id !== Number(id));
  memoryDB.classes = memoryDB.classes.map((item) => item.teacher_id === Number(id) ? { ...item, teacher_id: null } : item);
  saveDataStoreToFile();
};

const listClasses = () => memoryDB.classes
  .filter((classItem) => !/\bBCA\b/i.test(String(classItem.class_name).trim()))
  .map((classItem) => ({
    ...classItem,
    teacher_name: memoryDB.teachers.find((teacher) => teacher.teacher_id === classItem.teacher_id)?.full_name || null,
  }));

const createClass = (payload) => {
  const classItem = {
    class_id: nextIds.class_id++,
    ...payload,
    teacher_id: payload.teacher_id ? Number(payload.teacher_id) : null,
  };
  memoryDB.classes.push(classItem);
  saveDataStoreToFile();
  return classItem;
};

const updateClass = (id, payload) => {
  const index = memoryDB.classes.findIndex((classItem) => classItem.class_id === Number(id));
  if (index === -1) return null;
  memoryDB.classes[index] = { ...memoryDB.classes[index], ...payload, class_id: Number(id), teacher_id: payload.teacher_id ? Number(payload.teacher_id) : memoryDB.classes[index].teacher_id };
  saveDataStoreToFile();
  return memoryDB.classes[index];
};

const deleteClass = (id) => {
  memoryDB.classes = memoryDB.classes.filter((classItem) => classItem.class_id !== Number(id));
  memoryDB.students = memoryDB.students.map((student) => student.class_id === Number(id) ? { ...student, class_id: null } : student);
  memoryDB.attendance = memoryDB.attendance.filter((item) => item.class_id !== Number(id));
  saveDataStoreToFile();
};

const markAttendance = (classId, attendanceDate, records, subject = 'General', teacherId = null, classNumber = 1) => {
  const normalizedSubject = subject || 'General';
  const sessionRows = memoryDB.attendance.filter((item) =>
    item.class_id === Number(classId) &&
    (item.class_number || 1) === Number(classNumber) &&
    item.attendance_date === attendanceDate &&
    (item.subject || 'General') === normalizedSubject
  );

  if (sessionRows.length > 0 && sessionRows.some((item) => Number(item.edit_count || 0) >= 1)) {
    throw new Error('Attendance session already edited once for this class, subject and date.');
  }

  const editCount = sessionRows.length > 0 ? 1 : 0;
  const existing = new Map();
  memoryDB.attendance.forEach((item) => {
    existing.set(`${item.student_id}-${item.class_id}-${item.class_number || 1}-${item.attendance_date}-${item.subject || 'General'}`, item);
  });

  records.forEach((record) => {
    const currentSubject = record.subject || normalizedSubject;
    const key = `${record.student_id}-${classId}-${classNumber}-${attendanceDate}-${currentSubject}`;
    const existingItem = existing.get(key);
    const value = {
      attendance_id: existingItem ? existingItem.attendance_id : nextIds.attendance_id++,
      student_id: String(record.student_id),
      class_id: Number(classId),
      class_number: Number(classNumber),
      attendance_date: attendanceDate,
      subject: currentSubject,
      status: record.status || 'Present',
      marked_by: teacherId,
      recorded_at: new Date().toISOString(),
      edit_count: editCount,
    };
    const existingIndex = memoryDB.attendance.findIndex((item) => `${item.student_id}-${item.class_id}-${item.class_number || 1}-${item.attendance_date}-${item.subject || 'General'}` === key);
    if (existingIndex >= 0) {
      memoryDB.attendance[existingIndex] = { ...memoryDB.attendance[existingIndex], ...value };
    } else {
      memoryDB.attendance.push(value);
    }
  });

  saveDataStoreToFile();
  return memoryDB.attendance.filter((item) => item.class_id === Number(classId) && item.attendance_date === attendanceDate);
};

const getDailyAttendance = (date) => {
  return memoryDB.attendance
    .filter((item) => item.attendance_date === date)
    .map((item) => {
      const student = memoryDB.students.find((entry) => entry.student_id === item.student_id);
      const classInfo = memoryDB.classes.find((entry) => entry.class_id === item.class_id);
      return {
        ...item,
        full_name: student?.full_name || null,
        roll_number: student?.roll_number || null,
        class_name: classInfo?.class_name || null,
        section: classInfo?.section || null,
        class_number: item.class_number || 1,
        subject: item.subject || 'General',
        edit_count: item.edit_count || 0,
      };
    });
};

const getAttendanceReport = (studentId, startDate, endDate, subject = null) => {
  const numericStudentId = Number(studentId);
  const student = memoryDB.students.find((entry) => entry.student_id === numericStudentId || entry.roll_number === String(studentId)) || null;
  const filtered = student
    ? memoryDB.attendance.filter((item) => item.student_id === student.student_id)
    : [];
  const dateFiltered = filtered.filter((item) => {
    if (startDate && item.attendance_date < startDate) return false;
    if (endDate && item.attendance_date > endDate) return false;
    return true;
  });

  const subjectFiltered = subject
    ? dateFiltered.filter((item) => matchSubjectFilter(item.subject || 'General', subject))
    : dateFiltered;

  const groupedBySubjectDateAndClass = subjectFiltered.reduce((accumulator, item) => {
    const subjectName = item.subject || 'General';
    const classNumber = item.class_number || 1;
    const groupKey = `${subjectName}||${item.attendance_date}||${classNumber}`;
    if (!accumulator[groupKey]) {
      accumulator[groupKey] = {
        subjectName,
        attendance_date: item.attendance_date,
        class_number: classNumber,
        rows: [],
      };
    }
    accumulator[groupKey].rows.push(item);
    return accumulator;
  }, {});

  const subjectBreakdown = Object.values(groupedBySubjectDateAndClass)
    .map(({ subjectName, attendance_date, class_number, rows }) => {
      const presentCount = rows.filter((row) => row.status === 'Present').length;
      const totalCount = rows.length;
      return {
        subject: convertSubjectCode(subjectName),
        class_number,
        attendance_date,
        present_count: presentCount,
        total_count: totalCount,
        attendance_percentage: totalCount === 0 ? 0 : Number(((presentCount / totalCount) * 100).toFixed(2)),
      };
    })
    .sort((a, b) => {
      if (!a.attendance_date || !b.attendance_date) return a.subject.localeCompare(b.subject);
      if (a.attendance_date !== b.attendance_date) return a.attendance_date.localeCompare(b.attendance_date);
      return a.subject.localeCompare(b.subject);
    });

  const totalCount = subjectFiltered.length;
  const presentCount = subjectFiltered.filter((item) => item.status === 'Present').length;
  const attendancePercentage = totalCount === 0 ? 0 : Number(((presentCount / totalCount) * 100).toFixed(2));

  return {
    student_id: student?.student_id || numericStudentId,
    full_name: student?.full_name || null,
    roll_number: student?.roll_number || null,
    present_count: presentCount,
    total_count: totalCount,
    attendance_percentage: attendancePercentage,
    selected_subject: subject || null,
    subject_breakdown: subjectBreakdown,
  };
};

const getLowAttendanceStudents = () => {
  return listStudents().map((student) => {
    const studentAttendance = memoryDB.attendance.filter((item) => item.student_id === student.student_id);
    const totalCount = studentAttendance.length;
    const presentCount = studentAttendance.filter((item) => item.status === 'Present').length;
    const attendancePercentage = totalCount === 0 ? 0 : Number(((presentCount / totalCount) * 100).toFixed(2));

    return {
      ...student,
      attendance_percentage: attendancePercentage,
    };
  }).filter((student) => student.attendance_percentage < 75 || student.attendance_percentage === 0);
};

const getSummary = () => {
  const totalStudents = memoryDB.students.length;
  const presentToday = memoryDB.attendance.filter((item) => item.attendance_date === new Date().toISOString().split('T')[0] && item.status === 'Present').length;
  const lowAttendanceStudents = getLowAttendanceStudents();

  return {
    total_students: totalStudents,
    present_today: presentToday,
    low_attendance_percentage: lowAttendanceStudents.length === 0 ? 0 : Number((lowAttendanceStudents.length / totalStudents) * 100).toFixed(2),
  };
};

const createLeaveRequest = (payload) => {
  const studentKey = String(payload.student_id);
  const resolvedStudent = memoryDB.students.find((student) => student.student_id === studentKey || student.roll_number === studentKey) || null;
  const leave = {
    leave_id: nextIds.leave_id++,
    ...payload,
    student_id: resolvedStudent ? resolvedStudent.student_id : studentKey,
    status: 'Pending',
    created_at: new Date().toISOString(),
  };
  memoryDB.leave_requests.push(leave);
  saveDataStoreToFile();
  return leave;
};

const listLeaveRequests = () => {
  return memoryDB.leave_requests.map((leave) => {
    const student = memoryDB.students.find((entry) => entry.student_id === leave.student_id);
    return {
      ...leave,
      full_name: student?.full_name || null,
      roll_number: student?.roll_number || null,
    };
  });
};

const updateLeaveRequestStatus = (id, status) => {
  const leave = memoryDB.leave_requests.find((item) => item.leave_id === Number(id));
  if (!leave) return null;
  leave.status = status;
  saveDataStoreToFile();
  return leave;
};

module.exports = {
  memoryDB,
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  listTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  listClasses,
  createClass,
  updateClass,
  deleteClass,
  markAttendance,
  saveSubjectMarks,
  getSubjectMarks,
  getDailyAttendance,
  getAttendanceReport,
  getLowAttendanceStudents,
  getSummary,
  createLeaveRequest,
  listLeaveRequests,
  updateLeaveRequestStatus,
};
