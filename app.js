const API_URL = 'https://script.google.com/macros/s/AKfycbyw74KiDqJniJYcsPIJB4HhIpdx6cnrlx_0I08-odm16fPXJfUUuCuIBq9taWkeJJNA/exec';

let token = sessionStorage.getItem('admin_token') || '';
let allData = [];

const $ = id => document.getElementById(id);

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');

  setTimeout(() => {
    t.classList.remove('show');
  }, 2800);
}

function esc(s = '') {
  return String(s).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function badge(method) {
  let c = method.toLowerCase() === 'qris'
    ? 'qris'
    : method.toLowerCase() === 'transfer'
      ? 'transfer'
      : 'tunai';

  return `<span class="badge ${c}">${esc(method)}</span>`;
}

async function api(action, payload = {}) {
  if (!API_URL || API_URL.includes('PASTE_')) {
    throw new Error('URL Apps Script belum diatur di frontend/app.js');
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action,
      token,
      ...payload
    })
  });

  const data = await res.json();

  if (!data.ok) {
    throw new Error(data.message || 'Terjadi kesalahan');
  }

  return data;
}

function setPage(page) {
  document.querySelectorAll('.page')
    .forEach(p => p.classList.add('hidden'));

  $(page + 'Page').classList.remove('hidden');

  document.querySelectorAll('.nav')
    .forEach(n =>
      n.classList.toggle(
        'active',
        n.dataset.page === page
      )
    );

  const titles = {
    dashboard: [
      'Dashboard',
      'Ringkasan data pendaftaran'
    ],
    add: [
      'Tambah Pendaftar',
      'Masukkan data pendaftar baru'
    ],
    data: [
      'Data Pendaftar',
      'Lihat dan kelola seluruh data pendaftar'
    ]
  };

  $('pageTitle').textContent = titles[page][0];
  $('pageSubtitle').textContent = titles[page][1];

  if (page === 'dashboard') loadData();
  if (page === 'data') loadData();
}

async function loadData() {
  try {
    const r = await api('list');

    allData = r.data || [];

    renderStats();
    renderRecent();
    renderTable(allData);

  } catch (e) {
    showToast(e.message);
  }
}

function renderStats() {
  const count = x =>
    allData.filter(d => d.metode === x).length;

  $('statTotal').textContent = allData.length;
  $('statQris').textContent = count('QRIS');
  $('statTransfer').textContent = count('Transfer');
  $('statCash').textContent = count('Tunai');
}

function renderRecent() {
  const rows = allData.slice(0, 5);

  $('recentBody').innerHTML = rows.length
    ? rows.map((d, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(d.no)}</td>
          <td>${esc(d.nama)}</td>
          <td>${badge(d.metode)}</td>
          <td>${esc(d.pengikut)}</td>
          <td>${esc(d.tanggal)}</td>
          <td>
            <button
              class="icon-btn"
              onclick="viewData('${esc(d.id)}')">
              ◉
            </button>
          </td>
        </tr>
      `).join('')
    : `
        <tr>
          <td colspan="7">Belum ada data.</td>
        </tr>
      `;
}

function renderTable(rows) {
  $('dataBody').innerHTML = rows.length
    ? rows.map((d, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(d.no)}</td>
          <td>${esc(d.nama)}</td>
          <td>${esc(d.nikMasked)}</td>
          <td>${esc(d.pengikut)}</td>
          <td>${badge(d.metode)}</td>

          <td>
            ${d.identityFileUrl
              ? `<button
                  class="icon-btn"
                  onclick="viewData('${esc(d.id)}')">
                  📄
                </button>`
              : '—'
            }
          </td>

          <td>${esc(d.tanggal)}</td>

          <td>
            <div class="actions">
              <button
                class="icon-btn"
                onclick="viewData('${esc(d.id)}')">
                ◉
              </button>

              <button
                class="icon-btn"
                onclick="editData('${esc(d.id)}')">
                ✎
              </button>

              <button
                class="icon-btn danger"
                onclick="deleteData('${esc(d.id)}')">
                ⌫
              </button>
            </div>
          </td>
        </tr>
      `).join('')
    : `
        <tr>
          <td colspan="9">Belum ada data.</td>
        </tr>
      `;

  $('tableInfo').textContent =
    `Menampilkan ${rows.length} data`;
}


// ==============================
// FILE
// ==============================

function selectedIdentityFile() {
  return $('identityFile').files[0];
}

function selectedPaymentFile() {
  return $('paymentFile').files[0];
}

function validateFile(file, label) {

  if (!file) return true;

  if (file.size > 10 * 1024 * 1024) {
    showToast(`${label} maksimal 10 MB.`);
    return false;
  }

  const allowed = [
    'image/jpeg',
    'image/png',
    'application/pdf'
  ];

  if (!allowed.includes(file.type)) {
    showToast(
      `${label} harus JPG, JPEG, PNG, atau PDF.`
    );

    return false;
  }

  return true;
}

function fileToBase64(file) {

  return new Promise((resolve, reject) => {

    const rd = new FileReader();

    rd.onload = () => {
      resolve(
        String(rd.result).split(',')[1]
      );
    };

    rd.onerror = reject;

    rd.readAsDataURL(file);
  });
}


// ==============================
// RESET
// ==============================

function resetForm() {

  $('registrationForm').reset();

  delete $('registrationForm').dataset.editId;

  $('regNo').value =
    'Otomatis setelah disimpan';

  $('identityPreview').classList.add('hidden');
  $('identityPreview').innerHTML = '';

  $('paymentPreview').classList.add('hidden');
  $('paymentPreview').innerHTML = '';
}


// ==============================
// SUBMIT FORM
// ==============================

async function submitForm(e) {
  e.preventDefault();
  showLoading();
  const identityFile =
    selectedIdentityFile();

  const paymentFile =
    selectedPaymentFile();


  // DATA DIRI WAJIB
  if (!identityFile) {
    return showToast(
      'Data diri wajib diupload.'
    );
  }


  // VALIDASI DATA DIRI
  if (
    !validateFile(
      identityFile,
      'Data diri'
    )
  ) {
    return;
  }


  // VALIDASI BUKTI PEMBAYARAN
  // OPSIONAL
  if (
    paymentFile &&
    !validateFile(
      paymentFile,
      'Bukti pembayaran'
    )
  ) {
    return;
  }


  const nik =
    $('nik').value.trim();


  if (!/^\d{16}$/.test(nik)) {
    return showToast(
      'NIK harus 16 digit angka.'
    );
  }


  try {

    const editId =
      $('registrationForm')
        .dataset
        .editId || '';


    const payload = {

      id: editId,

      nama:
        $('name').value.trim(),

      nik: nik,

      pengikut:
        Number($('followers').value),

      metode:
        $('payment').value
    };


    // ==========================
    // DATA DIRI
    // ==========================

    if (identityFile) {

      const base64 =
        await fileToBase64(
          identityFile
        );

      payload.identityFileName =
        identityFile.name;

      payload.identityMimeType =
        identityFile.type;

      payload.identityFileBase64 =
        base64;
    }


    // ==========================
    // BUKTI PEMBAYARAN
    // ==========================

    if (paymentFile) {

      const base64 =
        await fileToBase64(
          paymentFile
        );

      payload.paymentFileName =
        paymentFile.name;

      payload.paymentMimeType =
        paymentFile.type;

      payload.paymentFileBase64 =
        base64;
    }


    const r =
      await api(
        editId
          ? 'update'
          : 'create',
        payload
      );


    showToast(
      `${editId
        ? 'Data berhasil diperbarui'
        : 'Data berhasil disimpan'
      } — ${r.no}`
    );


    resetForm();

    delete $('registrationForm')
      .dataset
      .editId;


    await loadData();

    setPage('data');


   } catch (err) {

    showToast(
      err.message
    );

  } finally {

    hideLoading();

  }
}


// ==============================
// DETAIL
// ==============================
function viewData(id) {

  const item = allData.find(
    x => String(x.id) === String(id)
  );

  if (!item) {
    showToast("Data tidak ditemukan.");
    return;
  }


  // ==============================
  // DATA UTAMA
  // ==============================

  const registrationNumber =
    item.no || "-";

  const nama =
    item.nama || "-";

  const nik =
    item.nikMasked ||
    maskNIKFrontend(item.nik) ||
    "-";

  const pengikut =
    item.pengikut !== undefined &&
    item.pengikut !== ""
      ? item.pengikut + " orang"
      : "-";

  const metode =
    item.metode || "-";

  const tanggal =
    item.tanggal || "-";


  // ==============================
  // DATA DIRI
  // ==============================

  const identityUrl =
    item.identityFileUrl ||
    item.fileUrl ||
    "";


  let identityDocument = "";

  if (identityUrl) {

    identityDocument = `
      <div class="document-card">

        <div class="document-left">

          <div class="document-icon">
            📄
          </div>

          <div class="document-info">

            <p class="document-title">
              Dokumen Data Diri
            </p>

            <p class="document-status available">
              ✓ File tersedia
            </p>

          </div>

        </div>

        <div class="document-action">

          <a
            href="${identityUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-document"
          >
            ↗ Buka Dokumen
          </a>

        </div>

      </div>
    `;

  } else {

    identityDocument = `
      <div class="document-card">

        <div class="document-left">

          <div class="document-icon">
            📄
          </div>

          <div class="document-info">

            <p class="document-title">
              Dokumen Data Diri
            </p>

            <p class="document-status empty">
              Belum ada dokumen data diri.
            </p>

          </div>

        </div>

        <div class="document-action">

          <span class="btn-document disabled">
            Belum tersedia
          </span>

        </div>

      </div>
    `;
  }


  // ==============================
  // BUKTI PEMBAYARAN
  // ==============================

  const paymentUrl =
    item.paymentFileUrl || "";


  let paymentDocument = "";


  if (paymentUrl) {

    paymentDocument = `
      <div class="document-card">

        <div class="document-left">

          <div class="document-icon payment">
            💳
          </div>

          <div class="document-info">

            <p class="document-title">
              Bukti Pembayaran
            </p>

            <p class="document-status available">
              ✓ File tersedia
            </p>

          </div>

        </div>

        <div class="document-action">

          <a
            href="${paymentUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-document"
          >
            ↗ Buka Bukti
          </a>

        </div>

      </div>
    `;

  } else {

    paymentDocument = `
      <div class="document-card">

        <div class="document-left">

          <div class="document-icon payment">
            💳
          </div>

          <div class="document-info">

            <p class="document-title">
              Bukti Pembayaran
            </p>

            <p class="document-status empty">
              Belum ada bukti pembayaran.
            </p>

          </div>

        </div>

        <div class="document-action">

          <span class="btn-document disabled">
            Belum tersedia
          </span>

        </div>

      </div>
    `;
  }


  // ==============================
  // TAMPILKAN MODAL
  // ==============================

  modalContent.innerHTML = `

    <div class="detail-wrapper">

      <!-- INFORMASI PENDAFTAR -->
      <div class="detail-section">

        <div class="detail-section-title">

          <span class="section-icon">
            👤
          </span>

          <span>
            Informasi Pendaftar
          </span>

        </div>


        <div class="detail-info-card">

          <div class="detail-info-item">

            <span class="detail-info-label">
              No. Pendaftaran
            </span>

            <div class="detail-info-value registration-number">
              ${escapeHtml(registrationNumber)}
            </div>

          </div>


          <div class="detail-info-item">

            <span class="detail-info-label">
              Nama Pendaftar
            </span>

            <div class="detail-info-value">
              ${escapeHtml(nama)}
            </div>

          </div>


          <div class="detail-info-item">

            <span class="detail-info-label">
              NIK
            </span>

            <div class="detail-info-value">
              ${escapeHtml(nik)}
            </div>

          </div>


          <div class="detail-info-item">

            <span class="detail-info-label">
              Jumlah Pengikut
            </span>

            <div class="detail-info-value">
              ${escapeHtml(pengikut)}
            </div>

          </div>


          <div class="detail-info-item">

            <span class="detail-info-label">
              Metode Pembayaran
            </span>

            <div class="detail-info-value">
              ${escapeHtml(metode)}
            </div>

          </div>


          <div class="detail-info-item">

            <span class="detail-info-label">
              Tanggal Input
            </span>

            <div class="detail-info-value">
              ${escapeHtml(tanggal)}
            </div>

          </div>

        </div>

      </div>


      <!-- DOKUMEN -->
      <div class="detail-section">

        <div class="detail-section-title">

          <span class="section-icon">
            📁
          </span>

          <span>
            Dokumen Pendaftar
          </span>

        </div>


        ${identityDocument}

        ${paymentDocument}

      </div>


      <!-- FOOTER -->
      <div class="detail-footer">

        <button
          type="button"
          class="btn primary"
          onclick="editData('${item.id}')"
        >
          ✎ Edit Data
        </button>

        <button
          type="button"
          class="btn ghost"
          onclick="printData('${item.id}')"
        >
          🖨 Cetak
        </button>

      </div>

    </div>

  `;


  modal.classList.remove("hidden");
}

// ==============================
// EDIT
// ==============================

function editData(id) {

  const d =
    allData.find(
      x => x.id === id
    );

  if (!d) return;


  setPage('add');


  $('regNo').value =
    d.no;

  $('name').value =
    d.nama;

  $('nik').value =
    d.nik;

  $('followers').value =
    d.pengikut;

  $('payment').value =
    d.metode;


  $('registrationForm')
    .dataset
    .editId = id;


  showToast(
    'Mode edit aktif. Data diri dapat diunggah ulang dan bukti pembayaran bersifat opsional.'
  );
}


// ==============================
// DELETE
// ==============================

async function deleteData(id) {

  const d =
    allData.find(
      x => x.id === id
    );

  if (
    !d ||
    !confirm(
      `Hapus ${d.no} — ${d.nama}?`
    )
  ) {
    return;
  }


  try {

    await api(
      'delete',
      { id }
    );

    showToast(
      'Data berhasil dihapus'
    );

    await loadData();

  } catch (e) {

    showToast(
      e.message
    );
  }
}

// ==============================
// LOGIN
// ==============================

$('login-form')
  .addEventListener(
    'submit',
    async e => {

      e.preventDefault();

      $('pesanLogin')
        .textContent = '';


      try {

        if (
          !API_URL ||
          API_URL.includes('PASTE_')
        ) {
          throw new Error(
            'URL Apps Script belum diatur di frontend/app.js'
          );
        }


        const res =
          await fetch(
            API_URL,
            {
              method: 'POST',
              body: JSON.stringify({
                action: 'login',

                username:
                  $('username')
                    .value
                    .trim(),

                password:
                  $('password')
                    .value
              })
            }
          );


        const r =
          await res.json();


        if (!r.ok) {
          throw new Error(
            r.message ||
            'Login gagal'
          );
        }


        token = r.token;

        sessionStorage.setItem(
          'admin_token',
          token
        );


        // Sembunyikan halaman login
        document
          .querySelector('.login-page')
          .classList
          .add('hidden');


        // Tampilkan dashboard
        $('app')
          .classList
          .remove('hidden');


        setPage('dashboard');


      } catch (e) {

        $('pesanLogin')
          .textContent =
          e.message;
      }

    }
  );


// ==============================
// PASSWORD
// ==============================

$('togglePassword').onclick =
  () => {

    $('password').type =
      $('password').type ===
      'password'
        ? 'text'
        : 'password';

  };


// ==============================
// NAVIGATION
// ==============================

document
  .querySelectorAll('[data-page]')
  .forEach(b => {

    b.addEventListener(
      'click',
      () => setPage(
        b.dataset.page
      )
    );

  });


// ==============================
// FORM
// ==============================

$('resetForm').onclick =
  resetForm;

$('registrationForm')
  .addEventListener(
    'submit',
    submitForm
  );


// ==============================
// DATA DIRI UPLOAD
// ==============================

$('dropZoneIdentity').onclick =
  () =>
    $('identityFile').click();


$('identityFile').onchange =
  () => {

    const f =
      selectedIdentityFile();

    if (f) {

      $('identityPreview')
        .classList
        .remove('hidden');

      $('identityPreview')
        .innerHTML =
        `📎 <strong>${esc(f.name)}</strong>
         <span>${Math.round(f.size / 1024)} KB</span>`;
    }

  };


// ==============================
// BUKTI PEMBAYARAN UPLOAD
// ==============================

$('dropZonePayment').onclick =
  () =>
    $('paymentFile').click();


$('paymentFile').onchange =
  () => {

    const f =
      selectedPaymentFile();

    if (f) {

      $('paymentPreview')
        .classList
        .remove('hidden');

      $('paymentPreview')
        .innerHTML =
        `📎 <strong>${esc(f.name)}</strong>
         <span>${Math.round(f.size / 1024)} KB</span>`;
    }

  };


// ==============================
// SEARCH
// ==============================

$('search').oninput =
  e => {

    const q =
      e.target.value
        .toLowerCase();


    renderTable(
      allData.filter(
        d =>
          [
            d.no,
            d.nama,
            d.nik
          ]
          .some(
            v =>
              String(v)
                .toLowerCase()
                .includes(q)
          )
      )
    );

  };


// ==============================
// MODAL
// ==============================

$('modalClose').onclick =
  () =>
    closeModal();


$('modal').onclick =
  e => {

    if (
      e.target ===
      $('modal')
    ) {
      closeModal();
    }

  };


function closeModal() {

  $('modal')
    .classList
    .add('hidden');

}


// ==============================
// AUTO LOGIN
// ==============================

if (token) {

  $('loginPage')
    .classList
    .add('hidden');

  $('app')
    .classList
    .remove('hidden');

  setPage('dashboard');

}

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function maskNIKFrontend(nik) {

  if (!nik) {
    return "";
  }

  const value = String(nik);

  if (value.length < 8) {
    return value;
  }

  return (
    value.substring(0, 4) +
    "********" +
    value.substring(value.length - 4)
  );

}

function showLoading() {
  const overlay =
    document.getElementById("loadingOverlay");

  if (overlay) {
    overlay.classList.remove("hidden");
  }
}


function hideLoading() {
  const overlay =
    document.getElementById("loadingOverlay");

  if (overlay) {
    overlay.classList.add("hidden");
  }
}