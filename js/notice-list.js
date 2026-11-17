const PAGE_SIZES = [20, 50, 100];
const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 20;
const PAGE_GROUP_SIZE = 5; // 페이지 번호를 몇 개씩 묶어 보여줄지

const tableWrap = document.getElementById("noticeTableWrap");
const tableBody = document.getElementById("noticeTableBody");
const rangeText = document.getElementById("noticeRangeText");
const pageSizeLabel = document.getElementById("noticePageSizeLabel");
const pageSizeSelect = document.getElementById("noticePageSizeSelect");
const pageText = document.getElementById("noticePageText");
const pagination = document.getElementById("noticePagination");
const messageBox = document.getElementById("noticeListMessage");
const messageText = document.getElementById("noticeListMessageText");
const firstPageButton = document.getElementById("noticeFirstPageButton");

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

// 주소를 바꾸고(기록 추가) 그 페이지를 조회합니다. 페이지 이동, 크기 변경에 사용합니다.
function goToPage(page, size) {
  const query = buildListQuery(page, size);

  // 같은 주소면 기록을 쌓지 않아, 뒤로가기를 여러 번 누르지 않아도 되게 합니다.
  if (query !== location.search) {
    history.pushState(null, "", query);
  }
  loadNotices();
}

// 현재 주소의 페이지를 다시 조회합니다. 상세 팝업에서 조회수를 갱신할 때도 호출합니다.
async function loadNotices() {
  const { page, size } = readListParams();
  const requestId = ++latestRequestId;

  try {
    const response = await fetch(`${API_BASE_URL}/notices${buildListQuery(page, size)}`);

    // $.ajax와 달리 fetch는 400/500에서 오류를 던지지 않아 직접 확인합니다.
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status; // catch에서 400을 구분하려고 담아 둡니다.
      throw error;
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

    // 요청 전에 page/size를 이미 고쳤으므로, 400은 화면과 서버의 검증 규칙이 어긋난 경우입니다.
    showListMessage(error.status === 400
      ? "잘못된 조회 조건입니다. 주소를 확인해 주세요."
      : "공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

function renderList({ items, totalCount, page, size, totalPages }) {
  if (totalPages === 0) {
    showListMessage("등록된 공지가 없습니다.");
    return;
  }

  // 마지막 페이지보다 큰 page를 요청하면 서버는 200 + 빈 items를 줍니다. 다시 요청하지 않습니다.
  if (items.length === 0) {
    showMissingPage(totalCount, size);
    return;
  }

  // 최신 글이 큰 번호: 번호 = 전체 건수 - 앞 페이지까지의 건수 - 이 페이지 안의 순서
  const firstNumber = totalCount - (page - 1) * size;
  tableBody.replaceChildren(
    ...items.map((notice, index) => createNoticeRow(notice, firstNumber - index))
  );

  rangeText.textContent = formatRange(totalCount, page, size);
  pageText.textContent = `${page}/${totalPages} page`;
  pageSizeSelect.value = String(size);
  renderPagination(page, totalPages);

  rangeText.hidden = false;
  pageSizeLabel.hidden = false;
  pageText.hidden = false;
  messageBox.hidden = true;
  tableWrap.hidden = false;
}

// 범위(1981~2000)는 의미가 없으므로 전체 건수만 보여주고, 페이징은 숨깁니다.
function showMissingPage(totalCount, size) {
  showListMessage("존재하지 않는 페이지입니다.", { showFirstPageButton: true });

  rangeText.textContent = `총 ${totalCount}건`;
  rangeText.hidden = false;
  pageSizeSelect.value = String(size);
  pageSizeLabel.hidden = false;
}

// 210건, 2페이지, 20개씩 → "21~40 / 총 210건". 끝 번호는 전체 건수를 넘지 않습니다.
function formatRange(totalCount, page, size) {
  const start = (page - 1) * size + 1;
  const end = Math.min(page * size, totalCount);
  return `${start}~${end} / 총 ${totalCount}건`;
}

// 현재 페이지가 속한 묶음(1~5, 6~10...)의 번호와 << < > >> 버튼을 그립니다.
// totalPages는 응답값을 그대로 쓰고 화면에서 다시 계산하지 않습니다.
function renderPagination(page, totalPages) {
  // 7페이지 → (7-1)/5 = 1.2 → 버림 1 → 1*5+1 = 6, 묶음은 6~10
  const groupStart = Math.floor((page - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const groupEnd = Math.min(groupStart + PAGE_GROUP_SIZE - 1, totalPages);
  const isFirstPage = page === 1;
  const isLastPage = page === totalPages;
  const isFirstGroup = groupStart === 1;
  const isLastGroup = groupEnd >= totalPages;

  // << >>는 첫/마지막 페이지로, < >는 이전 묶음의 끝/다음 묶음의 시작으로 이동합니다.
  // 예: 6~10 묶음에서 < → 5페이지, 1~5 묶음에서 > → 6페이지
  const buttons = [
    createPageButton("<<", 1, "첫 페이지", isFirstPage),
    createPageButton("<", groupStart - 1, "이전 묶음", isFirstGroup),
  ];

  for (let number = groupStart; number <= groupEnd; number++) {
    const isCurrent = number === page;
    const button = createPageButton(String(number), number, `${number} 페이지`, isCurrent);
    if (isCurrent) {
      button.setAttribute("aria-current", "page"); // CSS 강조와 스크린리더 안내에 함께 쓰입니다.
    }
    buttons.push(button);
  }

  buttons.push(
    createPageButton(">", groupEnd + 1, "다음 묶음", isLastGroup),
    createPageButton(">>", totalPages, "마지막 페이지", isLastPage)
  );

  pagination.replaceChildren(...buttons);
  pagination.hidden = false;
}

// 이동할 페이지는 data-page에 넣어 두고, 클릭은 nav 한 곳에서 처리합니다.
function createPageButton(text, targetPage, label, disabled) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.dataset.page = targetPage;
  button.disabled = disabled;
  button.setAttribute("aria-label", label);
  return button;
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
function showListMessage(text, { showFirstPageButton = false } = {}) {
  messageText.textContent = text;
  firstPageButton.hidden = !showFirstPageButton;
  messageBox.hidden = false;
  tableWrap.hidden = true;
  rangeText.hidden = true;
  pageSizeLabel.hidden = true;
  pageText.hidden = true;
  pagination.hidden = true;
}

// 버튼마다 이벤트를 걸지 않고 nav 하나에서 받습니다. (jQuery의 $(nav).on("click", "button", ...)와 같은 위임)
pagination.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button === null || button.disabled) {
    return;
  }
  // 페이지만 바꾸고 사용자가 고른 크기는 현재 주소의 값을 그대로 유지합니다.
  goToPage(Number(button.dataset.page), readListParams().size);
});

// 크기를 바꾸면 1페이지부터 다시 조회합니다.
pageSizeSelect.addEventListener("change", () => {
  goToPage(DEFAULT_PAGE, Number(pageSizeSelect.value));
});

// 없는 페이지 안내에서 사용합니다. 고른 크기는 유지합니다.
firstPageButton.addEventListener("click", () => {
  goToPage(DEFAULT_PAGE, readListParams().size);
});

// 뒤로가기/앞으로가기로 주소가 바뀌면 그 주소의 페이지를 조회합니다.
window.addEventListener("popstate", loadNotices);

loadNotices();
