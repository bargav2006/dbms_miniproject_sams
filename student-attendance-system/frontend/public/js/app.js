let token = localStorage.getItem('token') || '';

const setAuthState = (loggedIn) => {
  const status = document.getElementById('auth-status');
  const role = localStorage.getItem('role') || 'user';
  if (status) {
    status.textContent = loggedIn ? `Logged in as ${role}` : 'Not logged in';
    status.className = loggedIn ? 'small mt-2 text-success' : 'small mt-2 text-danger';
  }
};

const api = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Request failed');
  }

  return response.status === 204 ? {} : response.json();
};

const showTab = (tab) => {
  document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.add('d-none'));
  document.querySelectorAll('.nav-link').forEach((link) => link.classList.remove('active'));

  document.getElementById(tab).classList.remove('d-none');
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
};

const loadSummary = async () => {
  try {
    const summary = await api('/api/attendance/summary');
    document.getElementById('total-students').textContent = summary.total_students || 0;
    document.getElementById('attendance-today').textContent = summary.present_today || 0;
    document.getElementById('low-attendance').textContent = `${Number(summary.low_attendance_percentage || 0).toFixed(0)}%`;
  } catch (error) {
    console.error(error);
  }
};

const loadLowAttendance = async () => {
  try {
    const rows = await api('/api/attendance/low');
    const container = document.getElementById('low-attendance-list');
    container.innerHTML = rows.length ? rows.map((row) => `<div class="student-row"><div><strong>${row.full_name}</strong><br><small>${row.class_name || 'N/A'} • ${row.attendance_percentage || 0}%</small></div><span class="badge bg-warning text-dark">Needs Attention</span></div>`).join('') : '<p class="text-muted">No low attendance records.</p>';
  } catch (error) {
    console.error(error);
  }
};

const defaultAttendanceSubjects = [
  { code: 'aiml12', label: 'AIML' },
  { code: 'db12', label: 'DBMS' },
  { code: 'math12', label: 'Mathematics' },
  { code: 'py12', label: 'Python' },
  { code: 'ds12', label: 'Data Structures' },
];

const getSubjectLabel = (subjectCode) => {
  const item = defaultAttendanceSubjects.find((subject) => subject.code === subjectCode);
  return item ? item.label : subjectCode;
};

const populateAttendanceSubjects = () => {
  const subjectSelect = document.getElementById('attendance-subject');
  if (!subjectSelect) return;

  subjectSelect.innerHTML = defaultAttendanceSubjects.map((subject) => `<option value="${subject.code}">${subject.label}</option>`).join('');
  subjectSelect.value = defaultAttendanceSubjects[0].code;
};

const populateReportSubjects = () => {
  const subjectSelect = document.getElementById('report-subject');
  if (!subjectSelect) return;

  subjectSelect.innerHTML = `<option value="">All subjects</option>` + defaultAttendanceSubjects.map((subject) => `<option value="${subject.code}">${subject.label}</option>`).join('');
  subjectSelect.value = '';
};

const populateMarksSubjects = () => {
  const subjectSelect = document.getElementById('marks-subject-select');
  if (!subjectSelect) return;

  subjectSelect.innerHTML = defaultAttendanceSubjects.map((subject) => `<option value="${subject.code}">${subject.label}</option>`).join('');
  subjectSelect.value = defaultAttendanceSubjects[0].code;
};

const populateMarksStudents = (rows) => {
  const studentSelect = document.getElementById('marks-student-select');
  if (!studentSelect) return;

  studentSelect.innerHTML = '<option value="">Select student</option>' + rows.map((row) => `<option value="${row.student_id}">${row.full_name} (${row.student_id})</option>`).join('');
};

const loadDailyAttendance = async () => {
  try {
    const rows = await api(`/api/attendance/daily?date=${new Date().toISOString().split('T')[0]}`);
    const container = document.getElementById('daily-attendance-list');
    container.innerHTML = rows.length ? rows.map((row) => `<div class="student-row"><div><strong>${row.full_name}</strong><br><small>${getSubjectLabel(row.subject) || 'General'} • ${row.student_id || 'N/A'} • ${row.status}</small></div><span class="badge bg-primary">${row.status}</span></div>`).join('') : '<p class="text-muted">No attendance recorded yet.</p>';
  } catch (error) {
    console.error(error);
  }
};

const loadClasses = async () => {
  try {
    const classes = await api('/api/classes');
    const classSelect = document.getElementById('class-select');
    const studentSelect = document.querySelector('[name="class_id"]');

    classSelect.innerHTML = '<option value="">Select class</option>' + classes.map((item) => `<option value="${item.class_id}">${item.class_name} ${item.section || ''}</option>`).join('');

    if (studentSelect) {
      studentSelect.innerHTML = '<option value="">Select class</option>' + classes.map((item) => `<option value="${item.class_id}">${item.class_name} ${item.section || ''}</option>`).join('');
    }
  } catch (error) {
    console.error(error);
  }
};

const loadStudents = async () => {
  try {
    const rows = await api('/api/students');
    const body = document.getElementById('student-table-body');
    body.innerHTML = rows.map((row) => `
      <tr>
        <td>${row.student_id}</td>
        <td>${row.full_name}</td>
        <td>${row.class_name || 'Unassigned'} ${row.section || ''}</td>
        <td>${row.email || '-'}</td>
        <td>${row.phone || '-'}</td>
        <td><button class="btn btn-danger btn-sm delete-student" data-id="${row.student_id}">Delete</button></td>
      </tr>
    `).join('');

    populateMarksStudents(rows);

    document.querySelectorAll('.delete-student').forEach((button) => {
      button.addEventListener('click', async (event) => {
        const id = event.target.dataset.id;
        try {
          await api(`/api/students/${id}`, { method: 'DELETE' });
          loadStudents();
        } catch (error) {
          alert(error.message);
        }
      });
    });
  } catch (error) {
    console.error(error);
  }
};

const loadSubjectMarks = async (studentId) => {
  const container = document.getElementById('subject-marks-summary');
  if (!container || !studentId) {
    if (container) container.innerHTML = '';
    return;
  }

  try {
    const rows = await api(`/api/attendance/subject-marks?student_id=${encodeURIComponent(studentId)}`);
    if (!rows.length) {
      container.innerHTML = '<p class="text-muted">No subject IA marks recorded yet.</p>';
      return;
    }

    container.innerHTML = `
      <div class="table-responsive mt-3">
        <table class="table table-striped table-bordered align-middle">
          <thead class="table-light">
            <tr>
              <th>Subject</th>
              <th>IA 1</th>
              <th>IA 2</th>
              <th>IA 3</th>
              <th>Best of 2 Avg</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${row.subject}</td>
                <td>${row.ia1}</td>
                <td>${row.ia2}</td>
                <td>${row.ia3}</td>
                <td>${row.best_two_average}</td>
                <td><span class="badge ${row.status === 'Pass' ? 'bg-success' : 'bg-danger'}">${row.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    container.innerHTML = '<p class="text-danger">Unable to load subject marks.</p>';
  }
};

const saveSubjectMarks = async () => {
  const studentId = document.getElementById('marks-student-select').value;
  const subject = document.getElementById('marks-subject-select').value;
  const ia1 = document.getElementById('marks-ia1').value;
  const ia2 = document.getElementById('marks-ia2').value;
  const ia3 = document.getElementById('marks-ia3').value;

  if (!studentId || !subject) {
    alert('Select a student and subject first.');
    return;
  }

  const parsedScores = [ia1, ia2, ia3].map((value) => Number(value));
  if (parsedScores.some((value) => Number.isNaN(value))) {
    alert('Enter numeric IA marks.');
    return;
  }

  if (parsedScores.some((value) => value < 0 || value > 25)) {
    alert('IA marks must be between 0 and 25.');
    return;
  }

  try {
    const saved = await api('/api/attendance/subject-marks', {
      method: 'POST',
      body: JSON.stringify({
        student_id: studentId,
        subject,
        ia1: parsedScores[0],
        ia2: parsedScores[1],
        ia3: parsedScores[2],
      }),
    });

    alert(`Marks saved for ${getSubjectLabel(subject)}: Best of 2 average ${saved.best_two_average}, Result ${saved.status}`);
    await loadSubjectMarks(studentId);
  } catch (error) {
    alert(error.message);
  }
};

const loadAttendanceStudents = async () => {
  const classId = document.getElementById('class-select').value;
  const subject = document.getElementById('attendance-subject').value;
  const attendanceDate = document.getElementById('attendance-date').value || new Date().toISOString().split('T')[0];
  document.getElementById('attendance-date').value = attendanceDate;

  if (!classId) {
    document.getElementById('attendance-students').innerHTML = '<p class="text-muted">Select a class first.</p>';
    return;
  }

  if (!subject) {
    document.getElementById('attendance-students').innerHTML = '<p class="text-muted">Select a subject first.</p>';
    return;
  }

  try {
    const rows = await api('/api/students');
    const classStudents = rows.filter((row) => String(row.class_id) === String(classId));
    const container = document.getElementById('attendance-students');

    container.innerHTML = `
      <h5 class="fw-bold">${subject} Attendance for ${classStudents[0]?.class_name || 'Selected class'}</h5>
      <div class="mt-3">
        ${classStudents.map((student) => `
          <div class="student-row">
            <div>
              <strong>${student.full_name}</strong><br>
              <small>Roll: ${student.roll_number}</small>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input attendance-toggle" type="checkbox" data-student-id="${student.student_id}" checked>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error(error);
  }
};

const saveAttendance = async () => {
  const class_id = document.getElementById('class-select').value;
  const attendance_date = document.getElementById('attendance-date').value;
  const class_number = document.getElementById('class-number')?.value || '1';
  const subject = document.getElementById('attendance-subject').value;

  if (!class_id || !attendance_date || !subject || !class_number) {
    alert('Choose a class, class number, subject, and date first.');
    return;
  }

  const records = Array.from(document.querySelectorAll('.attendance-toggle')).map((input) => ({
    student_id: input.dataset.studentId,
    subject,
    status: input.checked ? 'Present' : 'Absent',
  }));

  try {
    await api('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({ class_id: Number(class_id), class_number: Number(class_number), attendance_date, subject, records }),
    });
    alert('Attendance saved successfully');
    loadSummary();
    loadDailyAttendance();
  } catch (error) {
    alert(error.message);
  }
};

const generateReport = async () => {
  const student_id = document.getElementById('report-student-id').value;
  const subject = document.getElementById('report-subject').value;
  const start_date = document.getElementById('report-start-date').value;
  const end_date = document.getElementById('report-end-date').value;

  if (!student_id) {
    alert('Enter a student ID');
    return;
  }

  try {
    const params = new URLSearchParams({ student_id });
    if (subject) params.append('subject', subject);
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);

    const report = await api(`/api/attendance/report?${params.toString()}`);
    const breakdownRows = Array.isArray(report.subject_breakdown) && report.subject_breakdown.length
      ? report.subject_breakdown
      : [{ subject: report.selected_subject || 'General', present_count: report.present_count || 0, total_count: report.total_count || 0, attendance_percentage: report.attendance_percentage || 0 }];

    document.getElementById('report-result').innerHTML = `
      <h5 class="fw-bold">Attendance Report</h5>
      <p><strong>Student:</strong> ${report.full_name || 'N/A'} (ID ${report.student_id})</p>
        <p><strong>Student ID:</strong> ${report.student_id || 'N/A'}</p>
      <p><strong>Selected Subject:</strong> ${report.selected_subject || 'All subjects'}</p>
      <p><strong>Total Records:</strong> ${report.total_count || 0}</p>
      <p><strong>Present:</strong> ${report.present_count || 0}</p>
      <p><strong>Attendance %:</strong> ${report.attendance_percentage || 0}%</p>
      <div class="table-responsive mt-3">
        <table class="table table-striped table-bordered align-middle">
          <thead class="table-light">
            <tr>
              <th>Subject</th>
              <th>Present</th>
              <th>Total</th>
              <th>Attendance %</th>
            </tr>
          </thead>
          <tbody>
            ${breakdownRows.map((row) => `
              <tr>
                <td>${row.subject || 'General'}</td>
                <td>${row.present_count || 0}</td>
                <td>${row.total_count || 0}</td>
                <td>${row.attendance_percentage || 0}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    alert(error.message);
  }
};

const addStudent = async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    roll_number: form.roll_number.value,
    full_name: form.full_name.value,
    class_id: Number(form.class_id.value),
    email: form.email.value,
    phone: form.phone.value,
  };

  try {
    await api('/api/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    form.reset();
    loadStudents();
    loadSummary();
    loadClasses();
  } catch (error) {
    alert(error.message);
  }
};

const loginDashboard = async (event) => {
  event.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

    const data = await response.json();
    token = data.token;
    localStorage.setItem('token', token);
    setAuthState(true);
    loadSummary();
    loadClasses();
    loadStudents();
    loadDailyAttendance();
    loadLowAttendance();
  } catch (error) {
    alert(error.message);
  }
};

const logout = () => {
  token = '';
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  setAuthState(false);
};

const bindEvents = () => {
  document.querySelectorAll('.nav-link[data-tab]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const tab = link.dataset.tab;
      if (tab) {
        showTab(tab);
      }
    });
  });

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', loginDashboard);
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  const loadStudentsBtn = document.getElementById('load-students-btn');
  if (loadStudentsBtn) {
    loadStudentsBtn.addEventListener('click', loadAttendanceStudents);
  }

  const saveAttendanceBtn = document.getElementById('save-attendance-btn');
  if (saveAttendanceBtn) {
    saveAttendanceBtn.addEventListener('click', saveAttendance);
  }

  const studentForm = document.getElementById('student-form');
  if (studentForm) {
    studentForm.addEventListener('submit', addStudent);
  }

  const reportBtn = document.getElementById('generate-report-btn');
  if (reportBtn) {
    reportBtn.addEventListener('click', generateReport);
  }

  const saveMarksBtn = document.getElementById('save-subject-marks-btn');
  if (saveMarksBtn) {
    saveMarksBtn.addEventListener('click', saveSubjectMarks);
  }

  const marksStudentSelect = document.getElementById('marks-student-select');
  if (marksStudentSelect) {
    marksStudentSelect.addEventListener('change', (event) => loadSubjectMarks(event.target.value));
  }
};

window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  populateAttendanceSubjects();
  populateReportSubjects();
  populateMarksSubjects();
  setAuthState(!!token);

  if (token) {
    loadSummary();
    loadClasses();
    loadStudents();
    loadDailyAttendance();
    loadLowAttendance();
  }

  document.getElementById('attendance-date').value = new Date().toISOString().split('T')[0];
});
