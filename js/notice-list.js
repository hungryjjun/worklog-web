const tableBody = document.getElementById("noticeTableBody");
const COLUMN_COUNT = 6;

// 상세 팝업에서 조회수를 갱신할 때도 호출합니다.
async function loadNotices() {
  try {
    const response = await fetch(`${API_BASE_URL}/notices`);

    // $.ajax와 달리 fetch는 404/500에서 오류를 던지지 않아 직접 확인합니다.
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const notices = await response.json();
    renderNotices(notices);
  } catch (error) {
    console.error("공지사항 목록 조회 실패:", error);
    showMessage("공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

function renderNotices(notices) {
  if (notices.length === 0) {
    showMessage("등록된 공지사항이 없습니다.");
    return;
  }

  tableBody.replaceChildren(...notices.map(createNoticeRow));
}

function createNoticeRow(notice) {
  const row = document.createElement("tr");

  row.append(
    createCell(notice.noticeSeq),
    createCategoryCell(notice.category),
    createTitleCell(notice),
    createCell(notice.createEmpNo),
    createCell(formatDate(notice.createAt)),
    createCell(notice.viewCnt)
  );

  return row;
}

// textContent는 jQuery의 .text()처럼 값을 글자로만 넣어 XSS를 막습니다.
function createCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value ?? "";
  return cell;
}

function createCategoryCell(category) {
  const cell = createCell(getCategoryName(category));
  if (category === "IMPORTANT") {
    cell.classList.add("category-important");
  }
  return cell;
}

function createTitleCell(notice) {
  const cell = document.createElement("td");
  cell.className = "col-title";

  const link = document.createElement("a");
  link.href = `notice-detail.html?noticeSeq=${encodeURIComponent(notice.noticeSeq)}`;
  link.textContent = notice.title;
  link.addEventListener("click", (event) => {
    event.preventDefault(); // 기본 동작인 현재 창 이동을 막습니다.
    openNoticePopup(link.href);
  });

  cell.append(link);
  return cell;
}

function openNoticePopup(url) {
  // 창 이름을 고정해 다른 제목을 눌러도 같은 팝업을 다시 사용합니다.
  const popup = window.open(url, "noticeDetail", "popup,width=720,height=640");

  // 팝업이 차단되면 null이 반환되므로 현재 창에서 이동합니다.
  if (popup === null) {
    location.href = url;
    return;
  }

  popup.focus();
}

function showMessage(text) {
  const row = document.createElement("tr");
  row.className = "message-row";

  const cell = createCell(text);
  cell.className = "message";
  cell.colSpan = COLUMN_COUNT;

  row.append(cell);
  tableBody.replaceChildren(row);
}

showMessage("불러오는 중입니다...");
loadNotices();
