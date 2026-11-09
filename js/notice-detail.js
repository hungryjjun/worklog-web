const NOT_FOUND_MESSAGE = "존재하지 않는 공지사항입니다.";
const LOAD_ERROR_MESSAGE = "공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";

const messageElement = document.getElementById("noticeMessage");
const detailElement = document.getElementById("noticeDetail");

async function loadNotice() {
  const noticeSeq = new URLSearchParams(location.search).get("noticeSeq");

  // 숫자가 아니면 서버가 400을 돌려주므로 호출 전에 걸러냅니다.
  if (noticeSeq === null || !/^\d+$/.test(noticeSeq)) {
    showMessage(NOT_FOUND_MESSAGE);
    return;
  }

  showMessage("불러오는 중입니다...");

  try {
    const response = await fetch(`${API_BASE_URL}/notices/${noticeSeq}`);

    if (response.status === 404) {
      showMessage(NOT_FOUND_MESSAGE);
      return;
    }

    // $.ajax와 달리 fetch는 404/500에서 오류를 던지지 않아 직접 확인합니다.
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const notice = await response.json();
    renderNotice(notice);
    refreshOpenerList();
  } catch (error) {
    console.error("공지사항 상세 조회 실패:", error);
    showMessage(LOAD_ERROR_MESSAGE);
  }
}

function renderNotice(notice) {
  const categoryElement = document.getElementById("noticeCategory");
  categoryElement.textContent = getCategoryName(notice.category);
  categoryElement.classList.toggle("category-important", notice.category === "IMPORTANT");

  // textContent는 jQuery의 .text()처럼 값을 글자로만 넣어 XSS를 막습니다.
  setText("noticeTitle", notice.title);
  setText("noticeCreateEmpNo", notice.createEmpNo);
  setText("noticeCreateAt", formatDateTime(notice.createAt));
  setText("noticeViewCnt", notice.viewCnt);
  setText("noticeContent", notice.content);

  messageElement.hidden = true;
  detailElement.hidden = false;
}

function setText(elementId, value) {
  document.getElementById(elementId).textContent = value ?? "";
}

// 목록 창의 조회수를 갱신합니다. 실패해도 상세 화면에는 영향을 주지 않습니다.
function refreshOpenerList() {
  try {
    window.opener?.loadNotices?.();
  } catch (error) {
    console.warn("목록 갱신 실패:", error);
  }
}

// window.close()는 스크립트로 연 창에서만 동작하므로 직접 접속하면 목록으로 이동합니다.
function closeDetail() {
  if (window.opener) {
    window.close();
  } else {
    location.href = "notice-list.html";
  }
}

function showMessage(text) {
  messageElement.textContent = text;
  messageElement.hidden = false;
  detailElement.hidden = true;
}

document.getElementById("closeButton").addEventListener("click", closeDetail);
loadNotice();
