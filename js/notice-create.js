const TITLE_MAX_LENGTH = 200;

const createDialog = document.getElementById("noticeCreateDialog");
const createForm = document.getElementById("noticeCreateForm");
const categoryInput = document.getElementById("noticeCategoryInput");
const titleInput = document.getElementById("noticeTitleInput");
const contentInput = document.getElementById("noticeContentInput");
const saveButton = document.getElementById("noticeSaveButton");
const formError = document.getElementById("noticeFormError");

function fillCategoryOptions() {
  Object.entries(NOTICE_CATEGORY_NAMES).forEach(([code, name]) => {
    categoryInput.add(new Option(name, code));
  });
}

function openCreateDialog() {
  createForm.reset();
  document.getElementById("noticeCreateDateText").textContent = getTodayText();
  clearFormError();
  createDialog.showModal(); // jQuery UI의 $("#id").dialog("open")에 해당합니다.
}

// 화면 표시용입니다. 실제 등록일시는 서버가 저장합니다.
function getTodayText() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${date}`;
}

function hasDraft() {
  return categoryInput.value !== ""
    || titleInput.value.trim() !== ""
    || contentInput.value.trim() !== "";
}

// 취소 버튼과 Esc 키가 함께 사용합니다.
function requestCloseCreateDialog() {
  if (saveButton.disabled) {
    return; // 저장 중에는 닫지 않습니다.
  }

  if (!hasDraft() || confirm("작성 중인 내용이 사라집니다. 취소하시겠습니까?")) {
    createDialog.close();
  }
}

// 문제가 있으면 안내 문구와 입력 위치를, 없으면 null을 돌려줍니다.
function validateNoticeForm() {
  const title = titleInput.value.trim();

  if (categoryInput.value === "") {
    return { input: categoryInput, message: "구분을 선택해 주세요." };
  }
  if (title === "") {
    return { input: titleInput, message: "제목을 입력해 주세요." };
  }
  if (title.length > TITLE_MAX_LENGTH) {
    return { input: titleInput, message: `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력해 주세요.` };
  }
  if (contentInput.value.trim() === "") {
    return { input: contentInput, message: "내용을 입력해 주세요." };
  }
  return null;
}

async function saveNotice(event) {
  event.preventDefault(); // 기본 동작인 페이지 새로고침을 막습니다.

  const invalid = validateNoticeForm();
  if (invalid !== null) {
    showFormError(invalid.message);
    invalid.input.focus();
    return;
  }

  clearFormError();
  saveButton.disabled = true; // 더블클릭으로 인한 중복 등록을 막습니다.

  try {
    const response = await fetch(`${API_BASE_URL}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: categoryInput.value,
        title: titleInput.value.trim(),
        content: contentInput.value.trim(),
        createEmpNo: TEMP_CREATE_EMP_NO,
      }),
    });

    if (response.status !== 201) {
      throw new Error(`HTTP ${response.status}`);
    }

    createDialog.close();
    loadNotices();
  } catch (error) {
    console.error("공지사항 등록 실패:", error);
    showFormError("공지사항을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    saveButton.disabled = false;
  }
}

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearFormError() {
  formError.textContent = "";
  formError.hidden = true;
}

fillCategoryOptions();
document.getElementById("noticeCreateEmpNoText").textContent = TEMP_CREATE_EMP_NO;

document.getElementById("noticeCreateOpenButton").addEventListener("click", openCreateDialog);
document.getElementById("noticeCancelButton").addEventListener("click", requestCloseCreateDialog);
createForm.addEventListener("submit", saveNotice);

// Esc 키의 기본 닫기를 막고 취소 버튼과 같은 흐름으로 처리합니다.
createDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  requestCloseCreateDialog();
});
