const PAGE_SIZES = [20, 50, 100];
const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 20;
const PAGE_GROUP_SIZE = 5; // 페이지 번호를 몇 개씩 묶어 보여줄지
const DEFAULT_SEARCH_TYPE = "ALL";
const KEYWORD_MAX_LENGTH = 20; // 서버 NoticeSearchRequest의 @Size(max = 20)와 같은 값

const searchForm = document.getElementById("noticeSearchForm");
const categorySelect = document.getElementById("noticeSearchCategory");
const searchTypeSelect = document.getElementById("noticeSearchType");
const keywordInput = document.getElementById("noticeSearchKeyword");
const fromInput = document.getElementById("noticeSearchFrom");
const toInput = document.getElementById("noticeSearchTo");
const searchResetButton = document.getElementById("noticeSearchResetButton");
const searchError = document.getElementById("noticeSearchError");

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

// 올해 1월 1일 ~ 12월 31일입니다. 사용자 PC의 날짜를 기준으로 합니다.
function getDefaultPeriod() {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

// 첫 화면과 초기화에 쓰는 검색 조건입니다.
function getDefaultSearch() {
  return { category: "", searchType: DEFAULT_SEARCH_TYPE, keyword: "", ...getDefaultPeriod() };
}

// "2026-11-23"만 통과합니다. "2026-1-5", "abc", 없는 날짜 "2026-02-30"은 false입니다.
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  // 2026-02-30을 넣으면 Date는 3월 2일로 넘깁니다. 넣은 값과 그대로 같아야 실제 있는 날짜입니다.
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

// from, to는 세 경우를 나눕니다.
// - 키가 없음(?page=1): 처음 들어온 화면이므로 올해 기본값
// - 빈 값(?from=): 사용자가 비웠으므로 그쪽 기간은 제한 없음
// - 이상한 값(?from=abc): 올해 기본값
function readDateParam(params, name, defaultValue) {
  const value = params.get(name);
  if (value === null) {
    return defaultValue;
  }
  return value === "" || isValidDate(value) ? value : defaultValue;
}

// URL의 page, size와 검색 조건을 읽습니다. 잘못된 값은 기본값으로 바꾸고 주소도 고칩니다.
function readListParams() {
  const params = new URLSearchParams(location.search);
  const pageValue = params.get("page") ?? String(DEFAULT_PAGE);
  const sizeValue = params.get("size") ?? String(DEFAULT_SIZE);

  const page = Number(pageValue);
  const size = Number(sizeValue);

  // "1.5", "abc", "0", "-1", 너무 큰 숫자는 모두 잘못된 page로 봅니다.
  const isValidPage = /^\d+$/.test(pageValue) && Number.isSafeInteger(page) && page >= 1;
  const isValidSize = PAGE_SIZES.map(String).includes(sizeValue);

  const category = params.get("category") ?? "";
  const searchType = params.get("searchType") ?? DEFAULT_SEARCH_TYPE;
  const keyword = (params.get("keyword") ?? "").trim();

  const defaultPeriod = getDefaultPeriod();
  let from = readDateParam(params, "from", defaultPeriod.from);
  let to = readDateParam(params, "to", defaultPeriod.to);

  // yyyy-MM-dd는 문자열 비교로 날짜 순서를 알 수 있습니다. 순서가 뒤집혔으면 둘 다 기본값으로 바꿉니다.
  if (from !== "" && to !== "" && from > to) {
    from = defaultPeriod.from;
    to = defaultPeriod.to;
  }

  // Object.hasOwn: "toString"처럼 모든 객체가 물려받은 이름은 통과시키지 않습니다. (in 연산자는 통과시킴)
  const listParams = {
    page: isValidPage ? page : DEFAULT_PAGE,
    size: isValidSize ? size : DEFAULT_SIZE,
    category: Object.hasOwn(NOTICE_CATEGORY_NAMES, category) ? category : "",
    searchType: Object.hasOwn(NOTICE_SEARCH_TYPE_NAMES, searchType) ? searchType : DEFAULT_SEARCH_TYPE,
    keyword: keyword.length <= KEYWORD_MAX_LENGTH ? keyword : "",
    from,
    to,
  };

  // 고친 값이 있으면 새 기록을 쌓지 않고 현재 주소만 바꿔서, 뒤로가기 때 잘못된 주소로 돌아가지 않게 합니다.
  const query = buildListQuery(listParams);
  if (query !== location.search) {
    history.replaceState(null, "", query);
  }
  return listParams;
}

// 화면 주소용 → "?page=1&size=20&keyword=휴가&from=2026-01-01&to="
// 빈 구분·검색어, 기본 검색대상(ALL)은 주소에서 뺍니다.
// from, to는 "키 없음(올해 기본값)"과 "빈 값(제한 없음)"을 구분해야 하므로 비어 있어도 남깁니다.
function buildListQuery({ page, size, category, searchType, keyword, from, to }) {
  // URLSearchParams는 jQuery의 $.param()처럼 한글·특수문자를 인코딩해 줍니다.
  const params = new URLSearchParams({ page, size });
  if (category) {
    params.set("category", category);
  }
  if (searchType !== DEFAULT_SEARCH_TYPE) {
    params.set("searchType", searchType);
  }
  if (keyword) {
    params.set("keyword", keyword);
  }
  params.set("from", from);
  params.set("to", to);
  return `?${params}`;
}

// 서버 요청용입니다. 값이 있는 조건만 보냅니다. from이 비면 보내지 않으므로 서버는 시작일 제한 없이 찾습니다.
function buildApiQuery(listParams) {
  const params = new URLSearchParams();
  Object.entries(listParams).forEach(([name, value]) => {
    if (value !== "") {
      params.set(name, value);
    }
  });
  return `?${params}`;
}

// 주소를 바꾸고(기록 추가) 그 조건으로 조회합니다. 검색, 초기화, 페이지 이동, 크기 변경이 모두 여기로 옵니다.
function goToList(listParams) {
  const query = buildListQuery(listParams);

  // 같은 주소면 기록을 쌓지 않아, 뒤로가기를 여러 번 누르지 않아도 되게 합니다.
  if (query !== location.search) {
    history.pushState(null, "", query);
  }
  showListFromUrl();
}

// 검색 조건은 그대로 두고 페이지와 크기만 바꿉니다. (등록 모달 notice-create.js에서도 사용)
function goToPage(page, size) {
  goToList({ ...readListParams(), page, size });
}

// 주소의 조건을 검색창에 채우고 목록을 조회합니다. 첫 화면, 뒤로가기, 이동할 때 사용합니다.
// loadNotices()에 넣지 않은 이유: 상세 팝업이 조회수 갱신으로 loadNotices()를 부를 때,
// 사용자가 검색창에 입력 중이던 값이 지워지지 않게 하려는 것입니다.
function showListFromUrl() {
  fillSearchForm(readListParams());
  // 사용자가 목록 조건을 바꿨다고 알립니다. notice-ai-search.js가 받아서 늦게 온 AI 응답을 버리고 안내를 지웁니다.
  // jQuery의 $(document).trigger("noticelistnavigate")와 같은 사용자 정의 이벤트입니다.
  document.dispatchEvent(new CustomEvent("noticelistnavigate"));
  loadNotices();
}

// 현재 주소의 조건으로 다시 조회합니다. 상세 팝업에서 조회수를 갱신할 때도 호출합니다.
async function loadNotices() {
  const listParams = readListParams();
  const requestId = ++latestRequestId;

  try {
    const response = await fetch(`${API_BASE_URL}/notices${buildApiQuery(listParams)}`);

    // $.ajax와 달리 fetch는 400/500에서 오류를 던지지 않아 직접 확인합니다.
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status; // catch에서 400을 구분하려고 담아 둡니다.
      if (response.status === 400) {
        // $.ajax의 xhr.responseJSON처럼, 서버 검증 메시지를 본문에서 꺼내 둡니다.
        error.serverMessage = await readErrorMessage(response);
      }
      throw error;
    }

    const data = await response.json();
    if (requestId !== latestRequestId) {
      return; // 그사이 다른 조건을 요청했으므로 이 응답은 버립니다.
    }
    renderList(data, listParams);
  } catch (error) {
    if (requestId !== latestRequestId) {
      return;
    }
    console.error("공지사항 목록 조회 실패:", error);

    // 요청 전에 조건을 이미 고쳤으므로, 400은 화면과 서버의 검증 규칙이 어긋난 경우입니다.
    // 서버 문구는 textContent로만 출력합니다. (showListMessage)
    showListMessage(error.status === 400
      ? (error.serverMessage ?? "잘못된 조회 조건입니다. 주소를 확인해 주세요.")
      : "공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

// 검색대상(searchType)은 검색어가 있어야 의미가 있으므로 조건으로 세지 않습니다. (서버 AI 검색과 같은 기준)
function hasSearchCondition({ category, keyword, from, to }) {
  return Boolean(category || keyword || from || to);
}

function renderList({ items, totalCount, page, size, totalPages }, listParams) {
  if (totalPages === 0) {
    showListMessage(hasSearchCondition(listParams)
      ? "일치하는 검색결과가 없습니다."
      : "등록된 공지가 없습니다.");
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

// 구분, 검색대상 옵션을 common.js의 코드표로 채웁니다. 화면에는 한글, value에는 서버 코드가 들어갑니다.
function fillSearchOptions() {
  Object.entries(NOTICE_CATEGORY_NAMES).forEach(([code, name]) => {
    categorySelect.add(new Option(name, code));
  });
  Object.entries(NOTICE_SEARCH_TYPE_NAMES).forEach(([code, name]) => {
    searchTypeSelect.add(new Option(name, code));
  });
}

// jQuery의 $("#id").val(값)과 같습니다. 날짜 칸에 ""를 넣으면 빈 칸이 됩니다.
function fillSearchForm({ category, searchType, keyword, from, to }) {
  categorySelect.value = category;
  searchTypeSelect.value = searchType;
  keywordInput.value = keyword;
  fromInput.value = from;
  toInput.value = to;
  hideSearchError(); // 화면이 새 조건으로 바뀌었으므로 이전 안내는 지웁니다.
}

function readSearchForm() {
  return {
    category: categorySelect.value,
    searchType: searchTypeSelect.value,
    keyword: keywordInput.value.trim(), // 공백만 입력하면 조건 없이 전체 검색이 됩니다.
    from: fromInput.value,
    to: toInput.value,
  };
}

// 검색창의 조건으로 1페이지부터 검색합니다. 사용자가 고른 페이지 크기는 유지합니다.
function searchNotices() {
  // 날짜를 "2026. 11. --"처럼 일부만 입력하면 value가 ""가 되어 조용히 기간 제한 없이 검색됩니다.
  // checkValidity()는 그런 칸(badInput)과 max를 넘은 칸을 false로 알려 줍니다.
  const invalidDateInput = [fromInput, toInput].find((input) => !input.checkValidity());
  if (invalidDateInput) {
    showSearchError("날짜를 끝까지 올바르게 입력해 주세요.", invalidDateInput);
    return;
  }

  const conditions = readSearchForm();
  if (conditions.from && conditions.to && conditions.from > conditions.to) {
    showSearchError("시작일은 종료일보다 늦을 수 없습니다.", fromInput);
    return;
  }

  goToList({ ...conditions, page: DEFAULT_PAGE, size: readListParams().size });
}

// 검색 조건을 기본값(전체 / 제목+내용 / 빈 검색어 / 올해)으로 되돌리고 다시 조회합니다. 크기는 유지합니다.
function resetSearch() {
  goToList({ ...getDefaultSearch(), page: DEFAULT_PAGE, size: readListParams().size });
}

// 검색하지 않고 안내만 합니다. 고칠 칸으로 커서를 옮겨 줍니다.
function showSearchError(text, focusTarget) {
  searchError.textContent = text;
  searchError.hidden = false;
  focusTarget?.focus();
}

function hideSearchError() {
  searchError.textContent = "";
  searchError.hidden = true;
}

// 검색 버튼 클릭과 검색어 칸의 Enter가 모두 submit으로 옵니다. (jQuery의 $(form).on("submit", ...))
searchForm.addEventListener("submit", (event) => {
  event.preventDefault(); // 폼의 기본 동작인 페이지 이동(새로고침)을 막습니다.
  searchNotices();
});

searchResetButton.addEventListener("click", resetSearch);

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

// 뒤로가기/앞으로가기로 주소가 바뀌면 그 주소의 조건을 검색창에 채우고 조회합니다.
window.addEventListener("popstate", showListFromUrl);

fillSearchOptions();
showListFromUrl();
