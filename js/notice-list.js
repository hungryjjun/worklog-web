const PAGE_SIZES = [20, 50, 100];
const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 20;

const tableWrap = document.getElementById("noticeTableWrap");
const tableBody = document.getElementById("noticeTableBody");
const rangeText = document.getElementById("noticeRangeText");
const pageSizeLabel = document.getElementById("noticePageSizeLabel");
const pageSizeSelect = document.getElementById("noticePageSizeSelect");
const pageText = document.getElementById("noticePageText");
const messageBox = document.getElementById("noticeListMessage");
const messageText = document.getElementById("noticeListMessageText");

// 마지막으로 보낸 요청 번호입니다. 늦게 도착한 이전 응답은 그리지 않습니다.
let latestRequestId = 0;

// URL의 page, size를 읽습니다. 잘못된 값이면 기본값으로 바꾸고 주소도 고칩니다.
function readListParams() {
  const params = new URLSearchParams(location.search);
  const pageValue = params.get("page") ?? String(DEFAULT_PAGE);
  const sizeValue = params.get("size") ?? String(DEFAULT_SIZE);

  const page = Number(pageValue);
  const size = Number(sizeValue);

  // "1.5", "abc", "0", "-1", 너무 큰 숫자는 모두 잘못된 page로 봅니다.
  const isValidPage = /^\d+$/.test(pageValue) && Number.isSafeInteger(page) && page >= 1;
  const isValidSize = PAGE_SIZES.map(String).includes(sizeValue);

  if (isValidPage && isValidSize) {
    return { page, size };
  }

  // 새 기록을 쌓지 않고 현재 주소만 바꿔서, 뒤로가기 때 잘못된 주소로 돌아가지 않게 합니다.
  history.replaceState(null, "", buildListQuery(DEFAULT_PAGE, DEFAULT_SIZE));
  return { page: DEFAULT_PAGE, size: DEFAULT_SIZE };
}

// { page: 2, size: 50 } → "?page=2&size=50"
function buildListQuery(page, size) {
  return `?${new URLSearchParams({ page, size })}`;
}

// 현재 주소의 페이지를 다시 조회합니다. 상세 팝업에서 조회수를 갱신할 때도 호출합니다.
async function loadNotices() {
  const { page, size } = readListParams();
  const requestId = ++latestRequestId;

  try {
    const response = await fetch(`${API_BASE_URL}/notices${buildListQuery(page, size)}`);

    // $.ajax와 달리 fetch는 400/500에서 오류를 던지지 않아 직접 확인합니다.
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (requestId !== latestRequestId) {
      return; // 그사이 다른 페이지를 요청했으므로 이 응답은 버립니다.
    }
    renderList(data);
  } catch (error) {
    if (requestId !== latestRequestId) {
      return;
    }
    console.error("공지사항 목록 조회 실패:", error);
    showListMessage("공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

function renderList({ items, totalCount, page, size, totalPages }) {
  // 최신 글이 큰 번호: 번호 = 전체 건수 - 앞 페이지까지의 건수 - 이 페이지 안의 순서
  const firstNumber = totalCount - (page - 1) * size;
  tableBody.replaceChildren(
    ...items.map((notice, index) => createNoticeRow(notice, firstNumber - index))
  );

  rangeText.textContent = formatRange(totalCount, page, size);
  pageText.textContent = `${page}/${totalPages} page`;
  pageSizeSelect.value = String(size);

  rangeText.hidden = false;
  pageSizeLabel.hidden = false;
  pageText.hidden = false;
  messageBox.hidden = true;
  tableWrap.hidden = false;
}

// 210건, 2페이지, 20개씩 → "21~40 / 총 210건". 끝 번호는 전체 건수를 넘지 않습니다.
function formatRange(totalCount, page, size) {
  const start = (page - 1) * size + 1;
  const end = Math.min(page * size, totalCount);
  return `${start}~${end} / 총 ${totalCount}건`;
}

function createNoticeRow(notice, number) {
  const row = document.createElement("tr");

  row.append(
    createCell(number),
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

// 표 대신 안내 문구를 보여주고, 건수·크기·페이지 표시는 숨깁니다.
function showListMessage(text) {
  messageText.textContent = text;
  messageBox.hidden = false;
  tableWrap.hidden = true;
  rangeText.hidden = true;
  pageSizeLabel.hidden = true;
  pageText.hidden = true;
}

loadNotices();
